import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:geolocator/geolocator.dart';
import 'package:camera/camera.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:typed_data';
import 'firebase_options.dart';

class AppConfig {
  // 🔴 DEMO DAY SETUP: Change 192.168.0.0 to your laptop's physical Wi-Fi IP if presenting on a real phone!
  static const String apiBaseUrl = 'http://192.168.29.254:5000/api';
}

List<CameraDescription> cameras = [];

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  
  await Hive.initFlutter();
  await Hive.openBox('citizen_outbox'); 
  await Hive.openBox('worker_outbox'); 
  await Hive.openBox('my_tickets'); 

  try { cameras = await availableCameras(); } catch (e) { debugPrint("Camera Error: $e"); }
  runApp(const SpotFixApp());
}

Future<Position> _determinePosition() async {
  bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
  if (!serviceEnabled) throw Exception('Location services disabled.');
  LocationPermission permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) throw Exception('Location denied');
  }
  if (permission == LocationPermission.deniedForever) throw Exception('Location permanently denied.');
  return await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
}

class SpotFixApp extends StatefulWidget {
  const SpotFixApp({super.key});
  @override
  State<SpotFixApp> createState() => _SpotFixAppState();
}

class _SpotFixAppState extends State<SpotFixApp> {
  String _lang = 'EN'; 
  void changeLang(String lang) => setState(() => _lang = lang);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SpotFix',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(useMaterial3: true, scaffoldBackgroundColor: const Color(0xFFF3F4F6), fontFamily: 'Roboto'),
      home: AuthGate(lang: _lang, onLangChange: changeLang),
    );
  }
}

const Map<String, Map<String, String>> t = {
  'EN': { 'citizen': 'Citizen / Omnichannel', 'inspector': 'Ward Site Inspector', 'worker': 'BMC Logistics Crew', 'police': 'Traffic Police Checkpoint', 'capture': 'Live Capture & Report', 'network_err': 'Network Dead Zone', 'spoof_err': 'Mock Location Detected. Blocked.', 'my_tickets': 'My Tickets', 'tab_waste': 'General Waste', 'tab_malba': 'Malba & Trucks' },
  'MR': { 'citizen': 'नागरिक', 'inspector': 'साइट निरीक्षक', 'worker': 'लॉजिस्टिक क्रू', 'police': 'वाहतूक पोलीस', 'capture': 'थेट कॅप्चर', 'network_err': 'नेटवर्क डेड झोन', 'spoof_err': 'बनावट स्थान.', 'my_tickets': 'माझी तिकिटे', 'tab_waste': 'सामान्य कचरा', 'tab_malba': 'मलब आणि ट्रक' },
  'HI': { 'citizen': 'नागरिक', 'inspector': 'साइट निरीक्षक', 'worker': 'लॉजिस्टिक्स क्रू', 'police': 'ट्रैफिक पुलिस', 'capture': 'लाइव कैप्चर', 'network_err': 'नेटवर्क डेड ज़ोन', 'spoof_err': 'मॉक लोकेशन.', 'my_tickets': 'मेरे टिकट', 'tab_waste': 'सामान्य कचरा', 'tab_malba': 'मलब और ट्रक' }
};

class AuthGate extends StatefulWidget {
  final String lang;
  final Function(String) onLangChange;
  const AuthGate({super.key, required this.lang, required this.onLangChange});
  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  String? role; 
  bool showCitizenLogin = false; // Toggles between Role Menu and Email Form
  bool isLogin = true;
  bool isLoading = false;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Auto-login if the citizen already has a saved session
    FirebaseAuth.instance.authStateChanges().listen((User? user) {
      if (mounted && user != null) {
        // Officials use anonymous login. Citizens use email.
        if (!user.isAnonymous) {
          setState(() => role = 'citizen');
        }
      }
    });
  }

  Future<void> _authenticate() async {
    setState(() => isLoading = true);
    try {
      UserCredential userCred;
      if (isLogin) {
        userCred = await FirebaseAuth.instance.signInWithEmailAndPassword(
          email: _emailController.text.trim(), 
          password: _passwordController.text.trim()
        );
      } else {
        userCred = await FirebaseAuth.instance.createUserWithEmailAndPassword(
          email: _emailController.text.trim(), 
          password: _passwordController.text.trim()
        );
      }
      
      // CRITICAL FIX: Download their history from MongoDB to Hive!
      String? token = await userCred.user!.getIdToken(true);
      await _syncTickets(token!, userCred.user!.uid);

      setState(() => role = 'citizen');
    } on FirebaseAuthException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message ?? "Auth Error"), backgroundColor: Colors.red));
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> _syncTickets(String token, String uid) async {
    try {
      var response = await http.get(
        Uri.parse('${AppConfig.apiBaseUrl}/tickets?citizenId=$uid'), 
        headers: {'Authorization': 'Bearer $token'}
      );
      if (response.statusCode == 200) {
        List data = jsonDecode(response.body)['data'];
        var box = await Hive.openBox('my_tickets');
        await box.clear(); // Clear any ghost data
        
        // Reverse the loop so newest tickets go to the bottom of Hive
        for (var t in data.reversed) { 
          await box.add({
            'id': t['_id'], 
            'cat': t['wasteCategory'], // This now dynamically shows the Upvoter's specific vote!
            'status': t['status'], 
            'date': t['createdAt'],
            'reason': t['rejectionReason'] ?? '' // NEW: Grab the rejection reason if it exists
          });
        }
      }
    } catch(e) { debugPrint("Sync Failed: $e"); }
  }

  Future<void> _demoLogin(String targetRole) async {
    setState(() => isLoading = true);
    try {
      await FirebaseAuth.instance.signInAnonymously(); 
      setState(() => role = targetRole);
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // 1. If a role is selected, show that specific Dashboard
    if (role != null) {
      if (role == 'citizen') return CitizenDashboard(lang: widget.lang);
      if (role == 'inspector') return const InspectorDashboard();
      if (role == 'worker') return const WorkerDashboard(); 
      return const PoliceEnforcementDashboard(); 
    }

    // 2. Otherwise, show the Login/Role Selection UI
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(backgroundColor: Colors.white, elevation: 0, actions: [DropdownButton<String>(value: widget.lang, underline: const SizedBox(), items: ['EN', 'MR', 'HI'].map((String val) => DropdownMenuItem(value: val, child: Text(val, style: const TextStyle(fontWeight: FontWeight.bold)))).toList(), onChanged: (val) => widget.onLangChange(val!)), const SizedBox(width: 20)]),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(30.0),
          child: showCitizenLogin ? _buildCitizenLoginForm() : _buildRoleSelection(),
        ),
      ),
    );
  }

  // --- UI WIDGET: The Original 4 Buttons ---
  Widget _buildRoleSelection() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.satellite_alt, size: 80, color: Color(0xFF166534)),
        const SizedBox(height: 20), const Text("SpotFix Enterprise", style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF166534))), const Text("Urban Sensor Network", style: TextStyle(color: Colors.grey, fontSize: 16)), const SizedBox(height: 30),
        
        // Clicking Citizen switches the UI state
        _roleButton(t[widget.lang]!['citizen']!, Icons.person, const Color(0xFF166534), () => setState(() => showCitizenLogin = true)), const SizedBox(height: 10),
        
        // Officials login anonymously and go straight to dashboard
        _roleButton(t[widget.lang]!['inspector']!, Icons.fact_check, Colors.teal[700]!, () => _demoLogin('inspector')), const SizedBox(height: 10),
        _roleButton(t[widget.lang]!['worker']!, Icons.engineering, Colors.orange[800]!, () => _demoLogin('worker')), const SizedBox(height: 10),
        _roleButton(t[widget.lang]!['police']!, Icons.local_police, const Color(0xFF1E3A8A), () => _demoLogin('police')),
      ],
    );
  }

  // --- UI WIDGET: The Email/Password Form ---
  Widget _buildCitizenLoginForm() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.person, size: 80, color: Color(0xFF166534)),
        const SizedBox(height: 20), const Text("Citizen Portal", style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF166534))), 
        const SizedBox(height: 30),
        TextField(controller: _emailController, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder())),
        const SizedBox(height: 15),
        TextField(controller: _passwordController, obscureText: true, decoration: const InputDecoration(labelText: 'Password', border: OutlineInputBorder())),
        const SizedBox(height: 20),
        ElevatedButton(
          style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 50), backgroundColor: const Color(0xFF166534)),
          onPressed: isLoading ? null : _authenticate,
          child: isLoading ? const CircularProgressIndicator(color: Colors.white) : Text(isLogin ? "Login" : "Register", style: const TextStyle(color: Colors.white, fontSize: 16)),
        ),
        TextButton(
          onPressed: () => setState(() => isLogin = !isLogin), 
          child: Text(isLogin ? "Need an account? Register" : "Have an account? Login", style: const TextStyle(color: Color(0xFF166534)))
        ),
        // Back Button to return to Role Selection
        TextButton(
          onPressed: () => setState(() => showCitizenLogin = false), 
          child: const Text("← Back to Role Selection", style: TextStyle(color: Colors.grey))
        ),
      ],
    );
  }

  Widget _roleButton(String text, IconData icon, Color color, VoidCallback onTap) {
    return InkWell(onTap: onTap, child: Container(width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 15), decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(10)), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, color: Colors.white), const SizedBox(width: 10), Text(text, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold))])));
  }
}

// ==========================================
// 2. CITIZEN DASHBOARD
// ==========================================
class CitizenDashboard extends StatefulWidget {
  final String lang;
  const CitizenDashboard({super.key, required this.lang});
  @override
  State<CitizenDashboard> createState() => _CitizenDashboardState();
}

class _CitizenDashboardState extends State<CitizenDashboard> {
  int _currentIndex = 0;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // CRITICAL FIX: Removed IndexedStack so the camera hardware is released when switching tabs!
      body: _currentIndex == 0 
          ? CitizenWasteTab(lang: widget.lang) 
          : _currentIndex == 1 
              ? CitizenMalbaTab(lang: widget.lang) 
              : CitizenTicketsTab(lang: widget.lang),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: const Color(0xFF166534),
        onTap: (index) => setState(() => _currentIndex = index),
        items: [
          BottomNavigationBarItem(icon: const Icon(Icons.delete_outline), label: t[widget.lang]!['tab_waste']!),
          BottomNavigationBarItem(icon: const Icon(Icons.fire_truck), label: t[widget.lang]!['tab_malba']!),
          BottomNavigationBarItem(icon: const Icon(Icons.receipt_long), label: t[widget.lang]!['my_tickets']!),
        ],
      ),
    );
  }
  }

class CitizenWasteTab extends StatefulWidget {
  final String lang;
  const CitizenWasteTab({super.key, required this.lang});
  @override
  State<CitizenWasteTab> createState() => _CitizenWasteTabState();
}

class _CitizenWasteTabState extends State<CitizenWasteTab> {
  CameraController? _cameraController;
  bool _isLoading = false;
  String _statusMessage = "System Ready.";
  String _selectedWasteType = 'Organic / Wet Waste'; 
  final List<String> _wasteTypes = ['Organic / Wet Waste', 'Plastic / Dry Waste', 'E-Waste', 'Hazardous Waste', 'Mixed Garbage'];
  final Battery _battery = Battery();
  late Box _outbox;

  @override
  void initState() {
    super.initState();
    _outbox = Hive.box('citizen_outbox');
    _initCameraSafely();
  }

  // CRITICAL FIX: Prevents the camera freeze (purple dot) when switching tabs
  Future<void> _initCameraSafely() async {
    if (cameras.isEmpty) return;
    await Future.delayed(const Duration(milliseconds: 400));
    if (!mounted) return;
    _cameraController = CameraController(cameras[0], ResolutionPreset.medium);
    await _cameraController!.initialize();
    if (mounted) setState(() {});
  }

  @override
  void dispose() { 
    _cameraController?.dispose(); 
    super.dispose(); 
  }

  Future<bool> _checkNetwork() async {
    var connectivityResult = await (Connectivity().checkConnectivity());
    if (connectivityResult.contains(ConnectivityResult.none) && connectivityResult.length == 1) {
      _showOfflineChoiceDialog();
      return false;
    }
    return true;
  }

  void _showOfflineChoiceDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Network Dead Zone", style: TextStyle(color: Colors.red)),
        content: const Text("You are offline. Save securely to device (Hive) and upload later, or dial 1916?"),
        actions: [
          ElevatedButton.icon(
            onPressed: () async { 
              Navigator.pop(context); 
              await _saveToHiveCache(); 
            }, 
            icon: const Icon(Icons.save_alt), label: const Text("Save Offline")
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red), 
            onPressed: () => launchUrl(Uri.parse("tel:1916")), 
            icon: const Icon(Icons.phone), label: const Text("Dial 1916")
          )
        ],
      ),
    );
  }

  Future<void> _saveToHiveCache() async {
    setState(() { _isLoading = true; _statusMessage = "Securing Payload to Hive..."; });
    try {
      Position position = await _determinePosition();
      if (_cameraController == null || !_cameraController!.value.isInitialized) throw Exception('Camera offline');
      XFile rawImage = await _cameraController!.takePicture();
      Uint8List compressedBytes = await FlutterImageCompress.compressWithList(await rawImage.readAsBytes(), minHeight: 1080, minWidth: 1080, quality: 60);

      await _outbox.add({
        'wasteCategory': _selectedWasteType, 
        'lat': position.latitude, 
        'lng': position.longitude, 
        'image': compressedBytes, 
        'time': DateTime.now().toIso8601String()
      });
      
      setState(() { _statusMessage = "✅ Ticket securely cached in Hive."; _isLoading = false; });
    } catch (e) {
      setState(() { _statusMessage = "❌ Error: $e"; _isLoading = false; });
    }
  }

  Future<void> _executeCapturePipeline() async {
    int batteryLevel = await _battery.batteryLevel;
    if (batteryLevel <= 15) {
      bool proceed = await showDialog(context: context, builder: (c) => AlertDialog(title: const Text("Low Battery Warning", style: TextStyle(color: Colors.red)), content: const Text("Battery <15%. Flash is disabled. Ensure enough light."), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text("Cancel")), ElevatedButton(onPressed: () => Navigator.pop(c, true), child: const Text("Proceed"))])) ?? false;
      if (!proceed) return;
    }

    if (!await _checkNetwork()) return;

    setState(() { _isLoading = true; _statusMessage = "1/5 Extracting Telemetry..."; });
    try {
      Position position = await _determinePosition();
      // Anti-spoofing temporarily bypass here for Hackathon truck routing math testing...comment the line below
      if (position.isMocked) { setState(() => _statusMessage = "❌ ${t[widget.lang]!['spoof_err']!}"); return; }
      if (_cameraController == null || !_cameraController!.value.isInitialized) throw Exception('Camera Hardware Offline');

      XFile rawImage = await _cameraController!.takePicture();
      setState(() => _statusMessage = "2/5 Compressing Evidence...");
      Uint8List compressedBytes = await FlutterImageCompress.compressWithList(await rawImage.readAsBytes(), minHeight: 1080, minWidth: 1080, quality: 60);

      setState(() => _statusMessage = "3/5 Securing Signature...");
      User? user = FirebaseAuth.instance.currentUser;
      
      // CRITICAL FIX: 'true' forces a token refresh, preventing 401 Unauthorized timeouts!
      String? token = await user!.getIdToken(true); 
      
      var sigResponse = await http.get(Uri.parse('${AppConfig.apiBaseUrl}/upload/signature'), headers: {'Authorization': 'Bearer $token'});
      var sigData = jsonDecode(sigResponse.body);

      setState(() => _statusMessage = "4/5 Uploading Compressed Payload...");
      var request = http.MultipartRequest('POST', Uri.parse('https://api.cloudinary.com/v1_1/${sigData['cloudName']}/image/upload'));
      request.fields['api_key'] = sigData['apiKey']; request.fields['timestamp'] = sigData['timestamp'].toString(); request.fields['signature'] = sigData['signature']; request.fields['folder'] = 'spotfix_evidence'; 
      request.files.add(http.MultipartFile.fromBytes('file', compressedBytes, filename: 'evidence.jpg'));
      var cloudResponse = await request.send();
      var cloudJson = jsonDecode(await cloudResponse.stream.bytesToString());
      
      setState(() => _statusMessage = "5/5 Database Routing...");
      // ... previous Cloudinary and API POST code ...
      var response = await http.post(Uri.parse('${AppConfig.apiBaseUrl}/tickets'), headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'}, body: jsonEncode({'wasteCategory': _selectedWasteType, 'latitude': position.latitude, 'longitude': position.longitude, 'evidenceImageUrls': [cloudJson['secure_url']]}));

      var responseData = jsonDecode(response.body);
      String realTicketId = responseData['data']?['_id'] ?? "TK-PENDING"; 

      // 🔴 THE ULTIMATE UX ERROR OPTIMIZER
      if (response.statusCode == 201) {
        await Hive.box('my_tickets').add({'id': realTicketId, 'cat': _selectedWasteType, 'status': 'Ticket Raised', 'date': DateTime.now().toIso8601String()});
        setState(() => _statusMessage = "✅ Success: Routed to Ward");
      } 
      else if (response.statusCode == 409) {
        await Hive.box('my_tickets').add({'id': realTicketId, 'cat': _selectedWasteType, 'status': 'Upvoted (Duplicate)', 'date': DateTime.now().toIso8601String()});
        setState(() => _statusMessage = "⚠️ ${responseData['message']}"); // Reads real backend message
      } 
      else if (response.statusCode == 400 || response.statusCode == 401 || response.statusCode == 403) {
        setState(() => _statusMessage = "🛑 ${responseData['message']}"); // Reads real backend message
      } 
      else { 
        setState(() => _statusMessage = "❌ Server Error (${response.statusCode})."); 
      }
    } catch (e) { setState(() => _statusMessage = "❌ Network Exception: $e"); } finally { setState(() => _isLoading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // CRITICAL FIX: Added Logout Button
      appBar: AppBar(
        title: Text(t[widget.lang]!['tab_waste']!, style: const TextStyle(color: Colors.white)), 
        backgroundColor: const Color(0xFF166534),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white), 
            onPressed: () async { 
              await FirebaseAuth.instance.signOut(); 
              
              // CRITICAL FIX: Wipe the local hard drive cache so it simulates a brand new phone!
              if (Hive.isBoxOpen('my_tickets')) await Hive.box('my_tickets').clear();
              if (Hive.isBoxOpen('citizen_outbox')) await Hive.box('citizen_outbox').clear();
              
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (context) => const SpotFixApp()), (route) => false);
              }
            }
          )
        ]
      ),
      body: Column(
        children: [
          Container(width: double.infinity, padding: const EdgeInsets.symmetric(horizontal: 20), color: Colors.white, child: DropdownButtonHideUnderline(child: DropdownButton<String>(value: _selectedWasteType, isExpanded: true, items: _wasteTypes.map((String type) => DropdownMenuItem<String>(value: type, child: Text(type, style: const TextStyle(fontWeight: FontWeight.bold)))).toList(), onChanged: (val) => setState(() => _selectedWasteType = val!)))),
          Expanded(child: Container(margin: const EdgeInsets.all(15), decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFF166534), width: 2)), child: ClipRRect(borderRadius: BorderRadius.circular(18), child: (_cameraController != null && _cameraController!.value.isInitialized) ? CameraPreview(_cameraController!) : const Center(child: CircularProgressIndicator())))),
          Text(_statusMessage, style: const TextStyle(fontWeight: FontWeight.bold), textAlign: TextAlign.center),
          Padding(padding: const EdgeInsets.all(15.0), child: ElevatedButton.icon(style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 55), backgroundColor: const Color(0xFF166534)), onPressed: _isLoading ? null : _executeCapturePipeline, icon: _isLoading ? const CircularProgressIndicator(color: Colors.white) : const Icon(Icons.camera_alt, color: Colors.white), label: Text(_isLoading ? 'Processing...' : 'Report General Waste', style: const TextStyle(color: Colors.white)))),
        ],
      ),
    );
  }
}

class CitizenMalbaTab extends StatefulWidget {
  final String lang;
  const CitizenMalbaTab({super.key, required this.lang});
  @override
  State<CitizenMalbaTab> createState() => _CitizenMalbaTabState();
}

class _CitizenMalbaTabState extends State<CitizenMalbaTab> {
  CameraController? _cameraController;
  bool _isLoading = false;
  String _statusMessage = "Point camera at debris or truck plate.";
  final TextEditingController _ocrPlateController = TextEditingController();
  final Battery _battery = Battery();
  late Box _outbox;

  @override
  void initState() {
    super.initState();
    _outbox = Hive.box('citizen_outbox');
    _initCameraSafely();
  }

  Future<void> _initCameraSafely() async {
    if (cameras.isEmpty) return;
    await Future.delayed(const Duration(milliseconds: 400));
    if (!mounted) return;
    _cameraController = CameraController(cameras[0], ResolutionPreset.medium);
    await _cameraController!.initialize();
    if (mounted) setState(() {});
  }

  @override
  void dispose() { 
    _cameraController?.dispose(); 
    _ocrPlateController.dispose(); 
    super.dispose(); 
  }

  Future<bool> _checkNetwork() async {
    var connectivityResult = await (Connectivity().checkConnectivity());
    if (connectivityResult.contains(ConnectivityResult.none) && connectivityResult.length == 1) {
      _showOfflineChoiceDialog();
      return false;
    }
    return true;
  }

  void _showOfflineChoiceDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Network Dead Zone", style: TextStyle(color: Colors.red)),
        content: const Text("You are offline. Save securely to device (Hive) and upload later, or dial 1916?"),
        actions: [
          ElevatedButton.icon(onPressed: () async { Navigator.pop(context); await _saveToHiveCache(); }, icon: const Icon(Icons.save_alt), label: const Text("Save Offline")),
          ElevatedButton.icon(style: ElevatedButton.styleFrom(backgroundColor: Colors.red), onPressed: () => launchUrl(Uri.parse("tel:1916")), icon: const Icon(Icons.phone), label: const Text("Dial 1916")),
        ],
      ),
    );
  }

  Future<void> _saveToHiveCache() async {
    setState(() { _isLoading = true; _statusMessage = "Securing Payload to Hive..."; });
    try {
      Position position = await _determinePosition();
      if (_cameraController == null || !_cameraController!.value.isInitialized) throw Exception('Camera offline');
      XFile rawImage = await _cameraController!.takePicture();
      Uint8List compressedBytes = await FlutterImageCompress.compressWithList(await rawImage.readAsBytes(), minHeight: 1080, minWidth: 1080, quality: 60);

      String payloadCategory = "Illegal Malba Dump";
      if (_ocrPlateController.text.isNotEmpty) { payloadCategory += " [Plate: ${_ocrPlateController.text}]"; }

      await _outbox.add({
        'wasteCategory': payloadCategory, 
        'lat': position.latitude, 
        'lng': position.longitude, 
        'image': compressedBytes, 
        'time': DateTime.now().toIso8601String()
      });
      
      setState(() { _statusMessage = "✅ Malba Evidence securely cached in Hive."; _isLoading = false; });
    } catch (e) {
      setState(() { _statusMessage = "❌ Error: $e"; _isLoading = false; });
    }
  }

  Future<void> _scanTruckPlateOCR() async {
    if (!await _checkNetwork()) return;
    setState(() { _isLoading = true; _statusMessage = "Calling Simulated OCR..."; });
    try {
      if (_cameraController == null || !_cameraController!.value.isInitialized) throw Exception('Camera Hardware Offline');
      XFile rawImage = await _cameraController!.takePicture();
      Uint8List rawBytes = await rawImage.readAsBytes();

      var request = http.MultipartRequest('POST', Uri.parse('${AppConfig.apiBaseUrl}/ocr/scan-plate'));
      request.files.add(http.MultipartFile.fromBytes('image', rawBytes, filename: 'scan.jpg'));
      
      var response = await request.send();
      if(response.statusCode == 200) {
        var responseData = jsonDecode(await response.stream.bytesToString());
        setState(() { _ocrPlateController.text = responseData['plate'] ?? "UNREADABLE"; _statusMessage = "OCR Complete. Verify text."; });
      } else { setState(() => _statusMessage = "OCR Engine Error. Please type manually."); }
    } catch (e) { setState(() => _statusMessage = "OCR Network Error: $e"); } finally { setState(() => _isLoading = false); }
  }

  Future<void> _submitMalbaReport() async {
    int batteryLevel = await _battery.batteryLevel;
    if (batteryLevel <= 15) {
      bool proceed = await showDialog(context: context, builder: (c) => AlertDialog(title: const Text("Low Battery"), content: const Text("Flash disabled."), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text("Cancel")), ElevatedButton(onPressed: () => Navigator.pop(c, true), child: const Text("Proceed"))])) ?? false;
      if (!proceed) return;
    }

    if (!await _checkNetwork()) return;

    setState(() { _isLoading = true; _statusMessage = "Submitting Evidence..."; });
    try {
      Position position = await _determinePosition();
      // Anti-spoofing temporarily bypass here for Hackathon truck routing math testing...comment the line below
      if (position.isMocked) { setState(() => _statusMessage = "❌ Mock Location Detected"); return; }
      if (_cameraController == null || !_cameraController!.value.isInitialized) throw Exception('Camera Hardware Offline');

      XFile rawImage = await _cameraController!.takePicture();
      Uint8List compressedBytes = await FlutterImageCompress.compressWithList(await rawImage.readAsBytes(), minHeight: 1080, minWidth: 1080, quality: 60);

      User? user = FirebaseAuth.instance.currentUser;
      
      // CRITICAL FIX: Force token refresh for Malba tab as well
      String? token = await user!.getIdToken(true);
      
      var sigResponse = await http.get(Uri.parse('${AppConfig.apiBaseUrl}/upload/signature'), headers: {'Authorization': 'Bearer $token'});
      var sigData = jsonDecode(sigResponse.body);

      var request = http.MultipartRequest('POST', Uri.parse('https://api.cloudinary.com/v1_1/${sigData['cloudName']}/image/upload'));
      request.fields['api_key'] = sigData['apiKey']; request.fields['timestamp'] = sigData['timestamp'].toString(); request.fields['signature'] = sigData['signature']; request.fields['folder'] = 'spotfix_evidence'; 
      request.files.add(http.MultipartFile.fromBytes('file', compressedBytes, filename: 'malba.jpg'));

      var cloudResponse = await request.send();
      var cloudJson = jsonDecode(await cloudResponse.stream.bytesToString());

      String payloadCategory = "Illegal Malba Dump";
      if (_ocrPlateController.text.isNotEmpty) { payloadCategory += " [Plate: ${_ocrPlateController.text}]"; }

      var response = await http.post(Uri.parse('${AppConfig.apiBaseUrl}/tickets'), headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'}, body: jsonEncode({'wasteCategory': payloadCategory, 'latitude': position.latitude, 'longitude': position.longitude, 'evidenceImageUrls': [cloudJson['secure_url']]}));
      
      var responseData = jsonDecode(response.body);
      String realTicketId = responseData['data']?['_id'] ?? "TK-PENDING";

      // CRITICAL FIX: UX Error Handling for Malba
      if (response.statusCode == 201) {
        await Hive.box('my_tickets').add({'id': realTicketId, 'cat': payloadCategory, 'status': 'Under Authority Review', 'date': DateTime.now().toIso8601String()});
        setState(() => _statusMessage = "✅ Confidential report submitted.");
      } 
      else if (response.statusCode == 400 || response.statusCode == 401 || response.statusCode == 403) {
        setState(() => _statusMessage = "🛑 ${responseData['message']}"); // Will perfectly say "Limit of 3 Malba reports reached"
      } 
      else { 
        setState(() => _statusMessage = "❌ Server Error (${response.statusCode})."); 
      }
    } catch(e) { setState(() => _statusMessage = "❌ Network Exception: $e"); } finally { setState(() => _isLoading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(t[widget.lang]!['tab_malba']!, style: const TextStyle(color: Colors.white)), 
        backgroundColor: Colors.brown[700],
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white), 
            onPressed: () async { 
              await FirebaseAuth.instance.signOut(); 
              
              // CRITICAL FIX: Wipe the local hard drive cache so it simulates a brand new phone!
              if (Hive.isBoxOpen('my_tickets')) await Hive.box('my_tickets').clear();
              if (Hive.isBoxOpen('citizen_outbox')) await Hive.box('citizen_outbox').clear();
              
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (context) => const SpotFixApp()), (route) => false);
              }
            }
          )
        ]
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity, padding: const EdgeInsets.all(12), color: Colors.orange[100],
            child: const Text("Note: If a truck is unloading, please try to capture the number plate clearly.", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.brown), textAlign: TextAlign.center),
          ),
          Expanded(
            child: Container(
              margin: const EdgeInsets.all(15), decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.brown, width: 2)),
              child: ClipRRect(borderRadius: BorderRadius.circular(18), child: (_cameraController != null && _cameraController!.value.isInitialized) ? CameraPreview(_cameraController!) : const Center(child: CircularProgressIndicator())),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 15.0),
            child: Row(
              children: [
                Expanded(child: TextField(controller: _ocrPlateController, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: "Truck Plate (Optional)", border: OutlineInputBorder(), isDense: true))),
                const SizedBox(width: 10),
                IconButton(onPressed: _isLoading ? null : _scanTruckPlateOCR, icon: const Icon(Icons.document_scanner), color: Colors.brown, iconSize: 35),
              ],
            ),
          ),
          Padding(padding: const EdgeInsets.all(8.0), child: Text(_statusMessage, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.brown), textAlign: TextAlign.center)),
          Padding(
            padding: const EdgeInsets.all(15.0),
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 55), backgroundColor: Colors.brown[700]),
              onPressed: _isLoading ? null : _submitMalbaReport,
              icon: _isLoading ? const CircularProgressIndicator(color: Colors.white) : const Icon(Icons.upload_file, color: Colors.white),
              label: const Text('Submit Secure Malba Evidence', style: TextStyle(color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }
}

// ------------------------------------------
// 2C. CITIZEN: MY TICKETS (WITH EDIT CAPABILITY)
// ------------------------------------------
class CitizenTicketsTab extends StatefulWidget {
  final String lang;
  const CitizenTicketsTab({super.key, required this.lang});
  @override
  State<CitizenTicketsTab> createState() => _CitizenTicketsTabState();
}

class _CitizenTicketsTabState extends State<CitizenTicketsTab> {
  final List<String> _wasteTypes = ['Organic / Wet Waste', 'Plastic / Dry Waste', 'E-Waste', 'Hazardous Waste', 'Mixed Garbage'];

  Color _getStatusColor(String status) {
    if (status.contains('Raised') || status.contains('Upvoted')) return Colors.orange;
    if (status.contains('Pending') || status.contains('Review')) return Colors.blue;
    if (status.contains('Assigned') || status.contains('Dispatched')) return Colors.purple;
    if (status.contains('Resolved') || status.contains('Closed')) return Colors.green;
    return Colors.grey;
  }

  Future<void> _refreshTickets() async {
    try {
      User? user = FirebaseAuth.instance.currentUser;
      if (user == null) return;
      String? token = await user.getIdToken();
      
      var response = await http.get(
        Uri.parse('${AppConfig.apiBaseUrl}/tickets?citizenId=${user.uid}'), 
        headers: {'Authorization': 'Bearer $token'}
      );
      
      if (response.statusCode == 200) {
        List data = jsonDecode(response.body)['data'];
        var box = Hive.box('my_tickets');
        await box.clear(); // Wipe old cache
        
        for (var t in data.reversed) { 
          await box.add({
            'id': t['_id'], 
            'cat': t['wasteCategory'], 
            'status': t['status'], 
            'date': t['createdAt'],
            'reason': t['rejectionReason'] ?? ''
          });
        }
      }
    } catch(e) { debugPrint("Refresh Failed: $e"); }
  }

  Future<void> _editCategory(int hiveIndex, Map ticket) async {
    String selectedType = _wasteTypes.contains(ticket['cat']) ? ticket['cat'] : _wasteTypes[0];
    bool isSubmitting = false;

    // CRITICAL FIX: Capture the ScaffoldMessenger BEFORE opening the dialog to prevent the crash!
    final scaffoldMessenger = ScaffoldMessenger.of(context);

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) => StatefulBuilder( // Use explicit dialogContext
        builder: (BuildContext stateContext, StateSetter setDialogState) {
          return AlertDialog(
            title: const Text("Edit Category (Once Only)", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            content: isSubmitting 
                ? const SizedBox(height: 50, child: Center(child: CircularProgressIndicator(color: Color(0xFF166534))))
                : DropdownButton<String>(
                    value: selectedType,
                    isExpanded: true,
                    items: _wasteTypes.map((String type) => DropdownMenuItem(value: type, child: Text(type))).toList(),
                    onChanged: (val) => setDialogState(() => selectedType = val!),
                  ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text("Cancel", style: TextStyle(color: Colors.grey))),
              if (!isSubmitting) ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF166534)),
                onPressed: () async {
                  setDialogState(() => isSubmitting = true);
                  try {
                    User? user = FirebaseAuth.instance.currentUser;
                    String? token = await user?.getIdToken(true); 
                    
                    var response = await http.put(
                      Uri.parse('${AppConfig.apiBaseUrl}/tickets/${ticket['id']}/category'),
                      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
                      body: jsonEncode({'newCategory': selectedType})
                    );
                    
                    var responseData = jsonDecode(response.body);

                    if (response.statusCode != 200) {
                      scaffoldMessenger.showSnackBar(SnackBar(content: Text(responseData['message'] ?? "Update failed."), backgroundColor: Colors.red));
                      Navigator.pop(dialogContext);
                      return;
                    }

                    // Update local Hive DB
                    var box = Hive.box('my_tickets');
                    var updatedTicket = Map.from(ticket);
                    updatedTicket['cat'] = selectedType;
                    await box.putAt(hiveIndex, updatedTicket);
                    
                    scaffoldMessenger.showSnackBar(const SnackBar(content: Text("Category updated successfully."), backgroundColor: Colors.green));
                    Navigator.pop(dialogContext);
                    
                  } catch (e) {
                    scaffoldMessenger.showSnackBar(SnackBar(content: Text("Network Error: $e"), backgroundColor: Colors.red));
                    Navigator.pop(dialogContext);
                  }
                }, 
                child: const Text("Update", style: TextStyle(color: Colors.white))
              )
            ],
          );
        }
      )
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!Hive.isBoxOpen('my_tickets')) return const Center(child: CircularProgressIndicator());
    return Scaffold(
      appBar: AppBar(
        title: Text(t[widget.lang]!['my_tickets']!, style: const TextStyle(color: Colors.white)), 
        backgroundColor: const Color(0xFF166534),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white), 
            onPressed: () async { 
              await FirebaseAuth.instance.signOut(); 
              
              // CRITICAL FIX: Wipe the local hard drive cache so it simulates a brand new phone!
              if (Hive.isBoxOpen('my_tickets')) await Hive.box('my_tickets').clear();
              if (Hive.isBoxOpen('citizen_outbox')) await Hive.box('citizen_outbox').clear();
              
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (context) => const SpotFixApp()), (route) => false);
              }
            }
          )
        ]
      ),
      body: ValueListenableBuilder(
        valueListenable: Hive.box('my_tickets').listenable(),
        builder: (context, Box box, _) {
          if (box.isEmpty) return const Center(child: Text("No tickets logged yet."));
          return RefreshIndicator(
            onRefresh: _refreshTickets,
            color: const Color(0xFF166534),
            child: ListView.builder(
              padding: const EdgeInsets.all(15), 
              itemCount: box.length,
              itemBuilder: (context, index) {
                int actualIndex = box.length - 1 - index;
                var ticket = box.getAt(actualIndex);
                bool isEditable = ticket['status'] == 'Ticket Raised' || ticket['status'] == 'Upvoted (Duplicate)';

              return Card(
                elevation: 3, margin: const EdgeInsets.only(bottom: 15), 
                child: ListTile(
                  leading: CircleAvatar(backgroundColor: _getStatusColor(ticket['status']), child: const Icon(Icons.receipt, color: Colors.white)), 
                  title: Text(ticket['cat'], style: const TextStyle(fontWeight: FontWeight.bold)), 
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("ID: ${ticket['id']}\nStatus: ${ticket['status']}\nDate: ${ticket['date'].toString().split('T')[0]}"),
                      // NEW: If rejected, show the Ward Officer's reason in Red!
                      if (ticket['status'] == 'Invalid Report' && ticket['reason'] != null && ticket['reason'].toString().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4.0),
                          child: Text("Reason: ${ticket['reason']}", style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                        )
                    ],
                  ),
                  isThreeLine: true,
                  // CRITICAL FIX: Adds Edit button if the ticket is still 'Ticket Raised'
                  trailing: isEditable 
                    ? IconButton(
                        icon: const Icon(Icons.edit, color: Colors.blue), 
                        onPressed: () => _editCategory(actualIndex, ticket)
                      ) 
                    : null,
                )
              );
            },
            ),
          );
        },
      ),
    );
  }
}

// ==========================================
// 3. SITE INSPECTOR DASHBOARD
// ==========================================
class InspectorDashboard extends StatefulWidget {
  const InspectorDashboard({super.key});
  @override
  State<InspectorDashboard> createState() => _InspectorDashboardState();
}

class _InspectorDashboardState extends State<InspectorDashboard> {
  final TextEditingController _notesController = TextEditingController();
  List<dynamic> _pendingTickets = [];
  bool _isLoading = true;
  String? _selectedTicketId;

  @override
  void initState() { super.initState(); _fetchPendingTickets(); }
  @override
  void dispose() { _notesController.dispose(); super.dispose(); }

  Future<void> _fetchPendingTickets() async {
    try {
      User? user = FirebaseAuth.instance.currentUser;
      String? token = await user?.getIdToken();
      // CRITICAL FIX: The Inspector now listens for tickets assigned by the Web Dashboard
      final uri = Uri.parse('${AppConfig.apiBaseUrl}/tickets').replace(queryParameters: {'status': 'Verification Pending'});
      var response = await http.get(uri, headers: {'Authorization': 'Bearer $token'});
      if (response.statusCode == 200) setState(() { _pendingTickets = jsonDecode(response.body)['data']; _isLoading = false; });
    } catch(e) { setState(() => _isLoading = false); }
  }

  Future<void> _updateStatus(String status) async {
    if (_selectedTicketId == null) return;
    
    // CRITICAL FIX: Use a SnackBar instead of the deleted _inspectorStatus variable
    if ((status == 'Logistics Assigned' || status == 'Invalid Report') && _notesController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("❌ Please enter manual verification notes."), 
          backgroundColor: Colors.red
        )
      );
      return; 
    }
    
    setState(() => _isLoading = true);
    try {
      User? user = FirebaseAuth.instance.currentUser;
      String? token = await user?.getIdToken();
      await http.put(
        Uri.parse('${AppConfig.apiBaseUrl}/tickets/$_selectedTicketId'), 
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'}, 
        body: jsonEncode({'status': status, 'inspectorNotes': _notesController.text})
      );
      _notesController.clear(); 
      _selectedTicketId = null; 
      await _fetchPendingTickets();
    } catch(e) { 
      setState(() => _isLoading = false); 
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ward Inspector', style: TextStyle(color: Colors.white)), 
        backgroundColor: Colors.teal[700],
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white), 
            onPressed: () async { 
              await FirebaseAuth.instance.signOut(); 
              
              // CRITICAL FIX: Wipe the local hard drive cache so it simulates a brand new phone!
              if (Hive.isBoxOpen('my_tickets')) await Hive.box('my_tickets').clear();
              if (Hive.isBoxOpen('citizen_outbox')) await Hive.box('citizen_outbox').clear();
              
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (context) => const SpotFixApp()), (route) => false);
              }
            }
          )
        ]
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : _pendingTickets.isEmpty 
          ? const Center(child: Text("No tickets pending verification."))
          : ListView.builder(
              itemCount: _pendingTickets.length,
              itemBuilder: (context, index) {
                var ticket = _pendingTickets[index];
                bool isSelected = _selectedTicketId == ticket['_id'];
                return Card(
                  margin: const EdgeInsets.all(10),
                  child: ExpansionTile(
                    title: Text("${ticket['wasteCategory']}", style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text("Lat: ${ticket['location']['coordinates'][1].toStringAsFixed(4)}, Lng: ${ticket['location']['coordinates'][0].toStringAsFixed(4)}"),
                    onExpansionChanged: (expanded) => setState(() => _selectedTicketId = expanded ? ticket['_id'] : null),
                    children: [
                      if (isSelected) Padding(
                        padding: const EdgeInsets.all(15.0),
                        child: Column(
                          children: [
                            TextField(
                              controller: _notesController, 
                              decoration: const InputDecoration(border: OutlineInputBorder(), hintText: "Enter site conditions, waste volume, and recommended truck type..."), 
                              maxLines: 3
                            ), 
                            const SizedBox(height: 10),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(backgroundColor: Colors.teal, minimumSize: const Size(double.infinity, 50)), 
                              onPressed: () {
                                if (_notesController.text.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("❌ Please enter field assessment notes."), backgroundColor: Colors.red));
                                  return;
                                }
                                // CRITICAL FIX: Status changes to Field Verified, not Logistics Assigned
                                _updateStatus('Field Verified');
                              }, 
                              icon: const Icon(Icons.send, color: Colors.white),
                              label: const Text("Submit Field Assessment to HQ", style: TextStyle(color: Colors.white))
                            )
                          ],
                        ),
                      )
                    ],
                  ),
                );
              }
            ),
    );
  }
}

// ==========================================
// 4. TRAFFIC POLICE CHECKPOINT UI
// ==========================================
class PoliceEnforcementDashboard extends StatefulWidget {
  const PoliceEnforcementDashboard({super.key});
  @override
  State<PoliceEnforcementDashboard> createState() => _PoliceEnforcementDashboardState();
}

class _PoliceEnforcementDashboardState extends State<PoliceEnforcementDashboard> {
  final TextEditingController _plateController = TextEditingController();
  bool _isScanning = false;
  Map<String, dynamic>? _scanResult;
  CameraController? _policeCameraController;
  bool _showCamera = false;

  @override
  void initState() {
    super.initState();
    if (cameras.isNotEmpty) {
      _policeCameraController = CameraController(cameras[0], ResolutionPreset.medium);
      _policeCameraController!.initialize().then((_) { if (mounted) setState(() {}); });
    }
  }

  @override
  void dispose() { _policeCameraController?.dispose(); _plateController.dispose(); super.dispose(); }

  Future<void> _captureAndRunOCR() async {
    setState(() => _showCamera = true);
    try {
      if (_policeCameraController == null || !_policeCameraController!.value.isInitialized) throw Exception('Camera offline');
      XFile rawImage = await _policeCameraController!.takePicture();
      Uint8List rawBytes = await rawImage.readAsBytes();

      var request = http.MultipartRequest('POST', Uri.parse('${AppConfig.apiBaseUrl}/ocr/scan-plate'));
      request.files.add(http.MultipartFile.fromBytes('image', rawBytes, filename: 'police_scan.jpg'));
      var response = await request.send();
      
      if(response.statusCode == 200) {
        var responseData = jsonDecode(await response.stream.bytesToString());
        setState(() { _plateController.text = responseData['plate'] ?? ""; _showCamera = false; });
      } else {
        setState(() => _showCamera = false); // CRITICAL FIX: Graceful UI recovery
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("OCR Server error. Enter manually.")));
      }
    } catch(e) {
      setState(() => _showCamera = false); // CRITICAL FIX: Graceful UI recovery
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("OCR Network Error: $e")));
    }
  }

  void _verifyPlate() async {
    if (_plateController.text.isEmpty) return;
    setState(() { _isScanning = true; _scanResult = null; });
    try {
      // CRITICAL FIX: Sent Firebase Auth Token to protected Truck Verify Endpoint
      User? user = FirebaseAuth.instance.currentUser;
      String? token = await user?.getIdToken();

      var response = await http.get(
        Uri.parse('${AppConfig.apiBaseUrl}/trucks/verify?plate=${_plateController.text}'),
        headers: {'Authorization': 'Bearer $token'}
      );
      if(response.statusCode == 200) {
        setState(() { _scanResult = jsonDecode(response.body)['data']; });
      } else {
        setState(() => _scanResult = { 'registered': false, 'plate': _plateController.text, 'contractor': 'UNKNOWN', 'status': 'No Record Found' });
      }
    } catch(e) {
      setState(() => _scanResult = { 'registered': false, 'plate': _plateController.text, 'contractor': 'NETWORK ERROR', 'status': 'Failed to reach DB' });
    } finally {
      setState(() => _isScanning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Enforcement Checkpoint', style: TextStyle(color: Colors.white)), 
        backgroundColor: const Color(0xFF1E3A8A), 
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white), 
            onPressed: () async { 
              await FirebaseAuth.instance.signOut(); 
              
              // CRITICAL FIX: Wipe the local hard drive cache so it simulates a brand new phone!
              if (Hive.isBoxOpen('my_tickets')) await Hive.box('my_tickets').clear();
              if (Hive.isBoxOpen('citizen_outbox')) await Hive.box('citizen_outbox').clear();
              
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (context) => const SpotFixApp()), (route) => false);
              }
            }
          )
        ]
        ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.shield, size: 60, color: Color(0xFF1E3A8A)), const SizedBox(height: 10), const Text("SpotFix C&D Tracking", textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)), const SizedBox(height: 20),
            if (_showCamera && _policeCameraController != null && _policeCameraController!.value.isInitialized)
              Container(height: 200, margin: const EdgeInsets.only(bottom: 20), decoration: BoxDecoration(borderRadius: BorderRadius.circular(15), border: Border.all(color: const Color(0xFF1E3A8A), width: 3)), child: ClipRRect(borderRadius: BorderRadius.circular(12), child: CameraPreview(_policeCameraController!))),
            TextField(controller: _plateController, textCapitalization: TextCapitalization.characters, decoration: InputDecoration(labelText: "License Plate Number", border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)), prefixIcon: const Icon(Icons.directions_car))), const SizedBox(height: 10),
            OutlinedButton.icon(style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 55)), onPressed: _showCamera ? null : _captureAndRunOCR, icon: const Icon(Icons.camera_alt), label: const Text('Live Camera OCR Scan')), const SizedBox(height: 15),
            ElevatedButton.icon(style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 55), backgroundColor: const Color(0xFF1E3A8A)), onPressed: _isScanning ? null : _verifyPlate, icon: _isScanning ? const CircularProgressIndicator(color: Colors.white) : const Icon(Icons.search, color: Colors.white), label: const Text('Verify DB Registry', style: TextStyle(color: Colors.white))), const SizedBox(height: 20),
            if (_scanResult != null) _buildResultCard(),
          ],
        ),
      ),
    );
  }

  Widget _buildResultCard() {
    bool isReg = _scanResult!['registered'] ?? false;
    return Card(
      color: isReg ? Colors.green[50] : Colors.red[50], shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15), side: BorderSide(color: isReg ? Colors.green : Colors.red, width: 2)),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            Icon(isReg ? Icons.check_circle : Icons.warning, color: isReg ? Colors.green : Colors.red, size: 50),
            Text(_scanResult!['plate'], style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 2)), const Divider(),
            ListTile(title: const Text("Contractor"), subtitle: Text(_scanResult!['contractor'])),
            ListTile(title: const Text("Status"), subtitle: Text(_scanResult!['status'], style: TextStyle(color: isReg ? Colors.green[700] : Colors.red[700], fontWeight: FontWeight.bold))),
            // CRITICAL FIX: "Generate Challan" Dialog popup
            if (!isReg) ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red), 
              onPressed: () {
                showDialog(context: context, builder: (c) => AlertDialog(title: const Text("RTO Action Triggered", style: TextStyle(color: Colors.red)), content: const Text("Draft Challan Generated — Pending Officer Approval."), actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text("OK", style: TextStyle(color: Colors.black)))]));
              }, 
              child: const Text("Generate RTO Challan", style: TextStyle(color: Colors.white))
            )
          ],
        ),
      ),
    );
  }
}

// ==========================================
// 5. BMC WORKER DASHBOARD
// ==========================================
class WorkerDashboard extends StatefulWidget {
  const WorkerDashboard({super.key});
  @override
  State<WorkerDashboard> createState() => _WorkerDashboardState();
}

class _WorkerDashboardState extends State<WorkerDashboard> {
  String _workerStatus = "Fetching assignments...";
  bool _isProcessing = false;
  late Box _workerOutbox;
  CameraController? _workerCameraController;
  Map<String, dynamic>? _assignedTask;
  
  // NEW: Store the 3 required images
  List<Uint8List> _capturedImages = []; 

  @override
  void initState() {
    super.initState();
    _workerOutbox = Hive.box('worker_outbox');
    if (cameras.isNotEmpty) {
      _workerCameraController = CameraController(cameras[0], ResolutionPreset.medium);
      _workerCameraController!.initialize().then((_) { if (mounted) setState(() {}); });
    }
    _fetchAssignedTask();
  }

  @override
  void dispose() { _workerCameraController?.dispose(); super.dispose(); }

  Future<void> _fetchAssignedTask() async {
    try {
      User? user = FirebaseAuth.instance.currentUser;
      String? token = await user?.getIdToken();
      final uri = Uri.parse('${AppConfig.apiBaseUrl}/tickets').replace(queryParameters: {'status': 'Logistics Assigned'});
      var response = await http.get(uri, headers: {'Authorization': 'Bearer $token'});
      
      if (response.statusCode == 200) {
        List tasks = jsonDecode(response.body)['data'];
        if (tasks.isNotEmpty) {
          setState(() { _assignedTask = tasks[0]; _workerStatus = "Drive to Target Coordinates."; _capturedImages.clear(); });
        } else {
          setState(() => _workerStatus = "No active dispatches.");
        }
      }
    } catch(e) { setState(() => _workerStatus = "Network error fetching tasks: $e"); }
  }

  Future<void> _captureVerificationAngle() async {
    if (_assignedTask == null || _isProcessing) return;
    setState(() => _isProcessing = true);
    
    try {
      Position pos = await _determinePosition();
      // Anti-spoofing temporarily bypass here for Hackathon truck routing math testing...comment the line below
      if (pos.isMocked) { setState(() { _workerStatus = "❌ FRAUD ALERT: Mock Location Detected."; _isProcessing = false; }); return; }

      double targetLat = _assignedTask!['location']['coordinates'][1];
      double targetLng = _assignedTask!['location']['coordinates'][0];
      double distanceInMeters = Geolocator.distanceBetween(pos.latitude, pos.longitude, targetLat, targetLng);
      if (distanceInMeters > 30) { setState(() { _workerStatus = "❌ FRAUD ALERT: You are ${distanceInMeters.round()}m away from site."; _isProcessing = false; }); return; }

      if (_workerCameraController == null || !_workerCameraController!.value.isInitialized) throw Exception('Camera offline');
      
      XFile rawImage = await _workerCameraController!.takePicture();
      Uint8List compressedBytes = await FlutterImageCompress.compressWithList(await rawImage.readAsBytes(), minHeight: 1080, minWidth: 1080, quality: 60);

      setState(() {
        _capturedImages.add(compressedBytes);
        _workerStatus = "✅ Angle ${_capturedImages.length}/3 Captured.";
      });

      // If we hit 3 images, trigger the massive upload!
      if (_capturedImages.length == 3) {
        await _uploadAllProofsAndResolve();
      } else {
        setState(() => _isProcessing = false); // Let them take the next photo
      }
    } catch(e) { setState(() { _workerStatus = "❌ Error: $e"; _isProcessing = false; }); } 
  }

Future<void> _uploadAllProofsAndResolve() async {
    setState(() => _workerStatus = "Checking Network Status...");
    
    try {
      // 1. SILENT NETWORK CHECK
      var connectivityResult = await (Connectivity().checkConnectivity());
      bool isOffline = connectivityResult.contains(ConnectivityResult.none) && connectivityResult.length == 1;

      // 2. OFFLINE FLOW: Auto-save to Hive without asking
      if (isOffline) {
        setState(() => _workerStatus = "Offline Mode: Securing Evidence to Device...");
        
        await _workerOutbox.add({
          'ticketId': _assignedTask!['_id'],
          'resolved': true,
          'images': _capturedImages, // Saves the list of 3 Uint8List images
          'time': DateTime.now().toIso8601String()
        });

        setState(() { 
          _workerStatus = "✅ Offline: Cleanup evidence secured locally."; 
          _assignedTask = null; 
          _capturedImages.clear(); 
        });
        return; // Stop execution here, don't try to hit Cloudinary
      }

      // 3. ONLINE FLOW: Upload to Cloudinary and MongoDB
      setState(() => _workerStatus = "Uploading 3 Verification Angles...");
      
      User? user = FirebaseAuth.instance.currentUser;
      String? token = await user!.getIdToken();
      List<String> uploadedCloudUrls = [];

      var sigResponse = await http.get(Uri.parse('${AppConfig.apiBaseUrl}/upload/signature?folder=spotfix_resolution'), headers: {'Authorization': 'Bearer $token'});
      var sigData = jsonDecode(sigResponse.body);

      // Loop and upload all 3 images
      for (int i = 0; i < _capturedImages.length; i++) {
        setState(() => _workerStatus = "Uploading Image ${i+1}/3...");
        var request = http.MultipartRequest('POST', Uri.parse('https://api.cloudinary.com/v1_1/${sigData['cloudName']}/image/upload'));
        request.fields['api_key'] = sigData['apiKey']; request.fields['timestamp'] = sigData['timestamp'].toString(); request.fields['signature'] = sigData['signature']; request.fields['folder'] = 'spotfix_resolution';
        request.files.add(http.MultipartFile.fromBytes('file', _capturedImages[i], filename: 'resolved_$i.jpg'));
        var cloudResponse = await request.send();
        var cloudJson = jsonDecode(await cloudResponse.stream.bytesToString());
        uploadedCloudUrls.add(cloudJson['secure_url']);
      }

      setState(() => _workerStatus = "Finalizing Database Entry...");
      await http.put(
        Uri.parse('${AppConfig.apiBaseUrl}/tickets/${_assignedTask!['_id']}'), 
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'}, 
        body: jsonEncode({'status': 'Resolved', 'resolutionImageUrls': uploadedCloudUrls})
      );
      
      setState(() { 
        _workerStatus = "✅ Online: Ticket Closed & Archived."; 
        _assignedTask = null; 
        _capturedImages.clear(); 
      });

    } catch(e) { 
      setState(() => _workerStatus = "❌ Error: $e"); 
    } finally { 
      setState(() => _isProcessing = false); 
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('BMC Logistics Crew', style: TextStyle(color: Colors.white)), 
        backgroundColor: Colors.orange[800], 
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white), 
            onPressed: () async { 
              await FirebaseAuth.instance.signOut(); 
              if (Hive.isBoxOpen('my_tickets')) await Hive.box('my_tickets').clear();
              if (Hive.isBoxOpen('citizen_outbox')) await Hive.box('citizen_outbox').clear();
              if (context.mounted) Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (context) => const SpotFixApp()), (route) => false);
            }
          )
        ]
        ),
      body: Column(
        children: [
          if (_assignedTask != null) Padding(padding: const EdgeInsets.all(15.0), child: Card(elevation: 5, child: ListTile(leading: const Icon(Icons.map, color: Colors.orange), title: Text("Dispatched: ${_assignedTask!['wasteCategory']}"), subtitle: Text("Target: ${_assignedTask!['location']['coordinates'][1].toStringAsFixed(4)}, ${_assignedTask!['location']['coordinates'][0].toStringAsFixed(4)}"), trailing: const Icon(Icons.warning, color: Colors.red)))),
          Expanded(child: Container(margin: const EdgeInsets.symmetric(horizontal: 20), decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.orange, width: _capturedImages.length == 3 ? 0 : 3)), child: ClipRRect(borderRadius: BorderRadius.circular(17), child: (_workerCameraController != null && _workerCameraController!.value.isInitialized && _capturedImages.length < 3) ? CameraPreview(_workerCameraController!) : const Center(child: Icon(Icons.check_circle, size: 100, color: Colors.green))))),
          
          // Image Counter Indicator
          if (_assignedTask != null) Padding(padding: const EdgeInsets.only(top: 10), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: List.generate(3, (index) => Icon(index < _capturedImages.length ? Icons.camera : Icons.camera_outlined, color: index < _capturedImages.length ? Colors.green : Colors.grey, size: 30)))),
          
          Container(margin: const EdgeInsets.all(15), padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: Colors.orange[50], border: Border.all(color: Colors.orange)), child: Text(_workerStatus, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold))),
          Padding(padding: const EdgeInsets.only(left: 20, right: 20, bottom: 20), child: ElevatedButton.icon(style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 60), backgroundColor: Colors.orange[800]), onPressed: (_isProcessing || _assignedTask == null || _capturedImages.length >= 3) ? null : _captureVerificationAngle, icon: _isProcessing ? const CircularProgressIndicator(color: Colors.white) : const Icon(Icons.my_location, color: Colors.white), label: Text(_isProcessing ? 'Processing...' : 'Capture Angle ${_capturedImages.length + 1} of 3', style: const TextStyle(color: Colors.white)))),
        ],
      ),
    );
  }
}