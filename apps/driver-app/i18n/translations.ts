export type IndianLanguageCode =
  | 'en'
  | 'hi'
  | 'hinglish'
  | 'mr'
  | 'bn'
  | 'ta'
  | 'te'
  | 'kn'
  | 'ml'
  | 'gu'
  | 'pa'
  | 'or'
  | 'ur'
  | 'as';

export interface LanguageOption {
  code: IndianLanguageCode;
  nativeLabel: string;
  englishName: string;
  regionHint: string;
}

export const INDIAN_LANGUAGES: LanguageOption[] = [
  { code: 'en', nativeLabel: 'English', englishName: 'English', regionHint: 'All India' },
  { code: 'hi', nativeLabel: 'हिन्दी', englishName: 'Hindi', regionHint: 'North & Central India' },
  { code: 'hinglish', nativeLabel: 'Hinglish', englishName: 'Hinglish', regionHint: 'Everyday Mix' },
  { code: 'mr', nativeLabel: 'मराठी', englishName: 'Marathi', regionHint: 'Maharashtra' },
  { code: 'bn', nativeLabel: 'বাংলা', englishName: 'Bengali', regionHint: 'West Bengal & Tripura' },
  { code: 'ta', nativeLabel: 'தமிழ்', englishName: 'Tamil', regionHint: 'Tamil Nadu' },
  { code: 'te', nativeLabel: 'తెలుగు', englishName: 'Telugu', regionHint: 'Telangana & AP' },
  { code: 'kn', nativeLabel: 'ಕನ್ನಡ', englishName: 'Kannada', regionHint: 'Karnataka' },
  { code: 'ml', nativeLabel: 'മലയാളം', englishName: 'Malayalam', regionHint: 'Kerala' },
  { code: 'gu', nativeLabel: 'ગુજરાતી', englishName: 'Gujarati', regionHint: 'Gujarat' },
  { code: 'pa', nativeLabel: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', regionHint: 'Punjab & Chandigarh' },
  { code: 'or', nativeLabel: 'ଓଡ଼ିଆ', englishName: 'Odia', regionHint: 'Odisha' },
  { code: 'ur', nativeLabel: 'اردو', englishName: 'Urdu', regionHint: 'Pan-India' },
  { code: 'as', nativeLabel: 'অসমীয়া', englishName: 'Assamese', regionHint: 'Assam' },
];

export interface AppTranslations {
  skip: string;
  next: string;
  back: string;
  continueBtn: string;
  loginBtn: string;
  signupBtn: string;
  splashTitle: string;
  splashSubtitle: string;
  bikeTitle: string;
  bikeBody: string;
  autoTitle: string;
  autoBody: string;
  cabTitle: string;
  cabBody: string;
  langLocationTitle: string;
  langLocationSubtitle: string;
  selectCityLabel: string;
  mapTitle: string;
  mapSubtitle: string;
  autoDetectGpsBtn: string;
  authTitle: string;
  authSubtitle: string;
  navHome: string;
  navEarnings: string;
  navRides: string;
  navRatings: string;
  navDashboard: string;
  navKyc: string;
  navWallet: string;
  navSupport: string;
  navSos: string;
  goOnline: string;
  goOffline: string;
  dutyLocked: string;
  partnerCockpit: string;
}

const EN: AppTranslations = {
  skip: 'Skip',
  next: 'Next',
  back: 'Back',
  continueBtn: 'Get Started',
  loginBtn: 'Login with Mobile OTP',
  signupBtn: 'Sign Up · Create Driver ID',
  splashTitle: 'SHINE CAPTAIN',
  splashSubtitle: 'Built for Bike, Auto & Cab Partners across India',
  bikeTitle: 'Bike Taxi Partner · Fast City Rides',
  bikeBody:
    'Earn on every short city hop with instant ride alerts, zero hidden deductions, and 24×7 safety protection on every SHINE CAPTAIN Bike trip.',
  autoTitle: 'Auto Rickshaw Partner · Daily Demand',
  autoBody:
    'Connect with daily commuters near metro stations, markets, and tech parks. Receive direct UPI & cash settlements with clear trip accounting.',
  cabTitle: 'Cab Partner · City & Airport Trips',
  cabBody:
    'Drive Hatchback, Sedan, or SUV cabs with verified customer bookings, OTP pickup security, and live GPS turn-by-turn routing.',
  langLocationTitle: 'Select Language & Operating City',
  langLocationSubtitle: 'Choose your preferred Indian language — the entire app translates instantly.',
  selectCityLabel: 'Operating City / Hub',
  mapTitle: 'Live Map & Auto GPS Location',
  mapSubtitle: 'Allow device GPS to auto-detect your exact pickup zone for nearby ride offers.',
  autoDetectGpsBtn: 'Auto-Detect My Location (GPS)',
  authTitle: 'Ready to Drive & Earn?',
  authSubtitle: 'Login to your existing partner account or Sign Up to create your Driver ID and upload KYC documents.',
  navHome: 'Home',
  navEarnings: 'Earnings',
  navRides: 'Rides',
  navRatings: 'Ratings',
  navDashboard: 'Dashboard',
  navKyc: 'KYC Status',
  navWallet: 'Wallet',
  navSupport: 'Support',
  navSos: 'Emergency SOS',
  goOnline: 'GO ONLINE',
  goOffline: 'ONLINE · GO OFFLINE',
  dutyLocked: 'DUTY LOCKED',
  partnerCockpit: 'Partner Duty Cockpit',
};

const HI: AppTranslations = {
  skip: 'स्किप करें',
  next: 'आगे बढ़ें',
  back: 'पीछे',
  continueBtn: 'शुरू करें',
  loginBtn: 'मोबाइल OTP से लॉगिन करें',
  signupBtn: 'साइन अप · नया ड्राइवर ID बनाएं',
  splashTitle: 'SHINE CAPTAIN',
  splashSubtitle: 'पूरे भारत के बाइक, ऑटो और कैब पार्टनर्स के लिए',
  bikeTitle: 'बाइक टैक्सी पार्टनर · तेज़ शहरी राइड्स',
  bikeBody:
    'हर छोटी शहरी ट्रिप पर तुरंत कमाई करें। पारदर्शी कमीशन, तुरंत UPI व कैश पेमेंट और 24×7 SOS सुरक्षा के साथ जुड़ें।',
  autoTitle: 'ऑटो रिक्शा पार्टनर · रोज़ाना बुकिंग',
  autoBody:
    'मेट्रो, बाज़ार और ऑफिस रूट के यात्रियों से सीधे जुड़ें। हर ट्रिप का साफ हिसाब और सुरक्षित OTP पिकअप पाएं।',
  cabTitle: 'कैब पार्टनर · शहर और एयरपोर्ट ट्रिप्स',
  cabBody:
    'हैचबैक, सेडान या SUV कैब चलाएं। वेरिफाइड कस्टमर बुकिंग, लाइव GPS नेविगेशन और सीधा बैंक पेआउट पाएं।',
  langLocationTitle: 'अपनी भाषा और शहर चुनें',
  langLocationSubtitle: 'कोई भी भारतीय भाषा चुनें — पूरा ऐप तुरंत आपकी भाषा में बदल जाएगा।',
  selectCityLabel: 'आपका शहर / ज़ोन चुनें',
  mapTitle: 'लाइव मैप और ऑटो GPS लोकेशन',
  mapSubtitle: 'आस-पास की राइड्स पाने के लिए ऑटो GPS लोकेशन डिटेक्ट करें।',
  autoDetectGpsBtn: 'मेरी लोकेशन ऑटो-डिटेक्ट करें (GPS)',
  authTitle: 'कमाई शुरू करने के लिए तैयार?',
  authSubtitle: 'अपने ड्राइवर अकाउंट में लॉगिन करें या नया ड्राइवर ID व दस्तावेज़ अपलोड करने के लिए साइन अप करें।',
  navHome: 'होम',
  navEarnings: 'कमाई',
  navRides: 'राइड्स',
  navRatings: 'रेटिंग्स',
  navDashboard: 'डैशबोर्ड',
  navKyc: 'KYC स्थिति',
  navWallet: 'वॉलेट',
  navSupport: 'सहायता',
  navSos: 'इमरजेंसी SOS',
  goOnline: 'ऑनलाइन जाएं',
  goOffline: 'ऑनलाइन · ऑफलाइन करें',
  dutyLocked: 'ड्यूटी लॉक है',
  partnerCockpit: 'पार्टनर ड्यूटी कॉकपिट',
};

const HINGLISH: AppTranslations = {
  ...EN,
  skip: 'Skip Karein',
  next: 'Aage Badhein',
  back: 'Peeche',
  continueBtn: 'Shuru Karein',
  loginBtn: 'Login (Mobile OTP)',
  signupBtn: 'Sign Up · Naya Driver ID Banayein',
  splashSubtitle: 'Bike, Auto aur Cab Partners ke liye bharosemand platform',
  bikeTitle: 'Bike Driver Partner · Tez City Rides',
  bikeBody:
    'Har city ride par turant kamai karein. Transparent commission, fast UPI/Cash settlement aur 24×7 SOS safety support.',
  autoTitle: 'Auto Rickshaw Partner · Rozana Demand',
  autoBody:
    'Metro aur market riders se seedha connect hon. Har trip ka clear hisab aur safe 4-digit Pickup OTP.',
  cabTitle: 'Cab Partner · City aur Airport Rides',
  cabBody:
    'Sedan, Hatchback ya SUV chalayein verified customer rides, live GPS map aur direct bank payout ke saath.',
  langLocationTitle: 'Apni Bhasha aur City Select Karein',
  langLocationSubtitle: 'Apni Indian language chunein — poora app turant translate ho jayega.',
  selectCityLabel: 'Aapka City / Operating Hub',
  mapTitle: 'Live Map aur Auto GPS Location',
  mapSubtitle: 'Device GPS se apni exact location auto-select karein taaki nearby rides milein.',
  autoDetectGpsBtn: 'Auto-Detect Location (GPS)',
  authTitle: 'Drive Aur Earn Shuru Karein',
  authSubtitle: 'Purane account me Login karein ya naya Driver ID aur documents upload karne ke liye Sign Up karein.',
  navHome: 'Home',
  navEarnings: 'Kamai',
  navRides: 'Rides',
  navRatings: 'Ratings',
  goOnline: 'ONLINE JAAYEIN',
  dutyLocked: 'DUTY LOCKED',
};

const MR: AppTranslations = {
  ...EN,
  skip: 'वगळा',
  next: 'पुढे',
  back: 'मागे',
  continueBtn: 'सुरू करा',
  loginBtn: 'मोबाईल OTP ने लॉगिन करा',
  signupBtn: 'साइन अप · नवीन ड्रायव्हर ID बनवा',
  splashSubtitle: 'बाईक, ऑटो आणि कॅब पार्टनर्ससाठी विश्वासार्ह प्लॅटफॉर्म',
  bikeTitle: 'बाईक टॅक्सी पार्टनर · जलद शहरी प्रवास',
  autoTitle: 'ऑटो रिक्षा पार्टनर · दैनंदिन राइड्स',
  cabTitle: 'कॅब पार्टनर · शहर आणि विमानतळ ट्रिप्स',
  langLocationTitle: 'तुमची भाषा आणि शहर निवडा',
  langLocationSubtitle: 'तुमची भारतीय भाषा निवडा — संपूर्ण अ‍ॅप लगेच भाषांतरित होईल.',
  selectCityLabel: 'तुमचे शहर निवडा',
  mapTitle: 'लाइव्ह मॅप आणि ऑटो GPS लोकेशन',
  autoDetectGpsBtn: 'माझे लोकेशन ऑटो-डिटेक्ट करा (GPS)',
  authTitle: 'प्रवास आणि कमाई सुरू करा',
  navHome: 'होम',
  navEarnings: 'कमाई',
  navRides: 'राइड्स',
  navRatings: 'रेटिंग्ज',
  navDashboard: 'डॅशबोर्ड',
  navKyc: 'KYC स्थिती',
  navWallet: 'वॉलेट',
  navSupport: 'मदत',
  goOnline: 'ऑनलाइन व्हा',
};

const BN: AppTranslations = {
  ...EN,
  skip: 'এড়িয়ে যান',
  next: 'পরবর্তী',
  back: 'পিছনে',
  continueBtn: 'শুরু করুন',
  loginBtn: 'মোবাইল OTP দিয়ে লগইন',
  signupBtn: 'সাইন আপ · ড্রাইভার ID তৈরি করুন',
  splashSubtitle: 'বাইক, অটো এবং ক্যাব পার্টনারদের জন্য তৈরি',
  bikeTitle: 'বাইক ট্যাক্সি পার্টনার · দ্রুত সিটি রাইড',
  autoTitle: 'অটো রিকশা পার্টনার · প্রতিদিনের রাইড',
  cabTitle: 'ক্যাব পার্টনার · শহর ও এয়ারপোর্ট ট্রিপ',
  langLocationTitle: 'ভাষা এবং শহর নির্বাচন করুন',
  langLocationSubtitle: 'আপনার ভারতীয় ভাষা বেছে নিন — পুরো অ্যাপ অনুবাদ হয়ে যাবে।',
  selectCityLabel: 'আপনার শহর নির্বাচন করুন',
  mapTitle: 'লাইভ ম্যাপ ও অটো GPS লোকেশন',
  autoDetectGpsBtn: 'আমার লোকেশন অটো-ডিটেক্ট করুন (GPS)',
  authTitle: 'ড্রাইভ ও আয় শুরু করুন',
  navHome: 'হোম',
  navEarnings: 'আয়',
  navRides: 'রাইডস',
  navRatings: 'রেটিং',
  navDashboard: 'ড্যাশবোর্ড',
  navKyc: 'KYC স্ট্যাটাস',
  navWallet: 'ওয়ালেট',
  navSupport: 'সাপোর্ট',
  goOnline: 'অনলাইন হোন',
};

const TA: AppTranslations = {
  ...EN,
  skip: 'தவிர்',
  next: 'அடுத்து',
  back: 'பின்',
  continueBtn: 'தொடங்கு',
  loginBtn: 'மொபைல் OTP உள்நுழைவு',
  signupBtn: 'பதிவு செய் · டிரைவர் ID உருவாக்கு',
  splashSubtitle: 'பைக், ஆட்டோ மற்றும் கார் ஓட்டுநர்களுக்கான நம்பகமான தளம்',
  bikeTitle: 'பைக் டாக்ஸி பார்ட்னர் · விரைவு பயணங்கள்',
  autoTitle: 'ஆட்டோ பார்ட்னர் · தினசரி சவாரிகள்',
  cabTitle: 'கார் பார்ட்னர் · நகரம் & விமான நிலையம்',
  langLocationTitle: 'மொழி மற்றும் நகரத்தைத் தேர்ந்தெடுக்கவும்',
  langLocationSubtitle: 'உங்கள் இந்திய மொழியைத் தேர்வுசெய்க — செயலி உடனடியாக மொழிபெயர்க்கப்படும்.',
  selectCityLabel: 'இயங்கும் நகரம்',
  mapTitle: 'நேரலை வரைபடம் & தானியங்கி GPS',
  autoDetectGpsBtn: 'என் இருப்பிடத்தைக் கண்டறி (GPS)',
  authTitle: 'ஓட்டவும் சம்பாதிக்கவும் தயாரா?',
  navHome: 'முகப்பு',
  navEarnings: 'வருமானம்',
  navRides: 'சவாரிகள்',
  navRatings: 'மதிப்பீடுகள்',
  navDashboard: 'டாஷ்போர்டு',
  navKyc: 'KYC நிலை',
  navWallet: 'வாலட்',
  navSupport: 'உதவி',
  goOnline: 'ஆன்லைன் செல்',
};

const TE: AppTranslations = {
  ...EN,
  skip: 'దాటవేయి',
  next: 'తరువాత',
  back: 'వెనుకకు',
  continueBtn: 'ప్రారంభించండి',
  loginBtn: 'మొబైల్ OTP తో లాగిన్',
  signupBtn: 'సైన్ అప్ · డ్రైవర్ ID సృష్టించండి',
  splashSubtitle: 'బైక్, ఆటో మరియు క్యాబ్ పార్ట్‌నర్స్ కోసం',
  bikeTitle: 'బైక్ ట్యాక్సీ పార్ట్‌నర్ · వేగవంతమైన రైడ్స్',
  autoTitle: 'ఆటో రిక్షా పార్ట్‌నర్ · రోజువారీ బుకింగ్స్',
  cabTitle: 'క్యాబ్ పార్ట్‌నర్ · సిటీ & ఎయిర్‌పోర్ట్',
  langLocationTitle: 'భాష మరియు నగరాన్ని ఎంచుకోండి',
  langLocationSubtitle: 'మీ భారతీయ భాషను ఎంచుకోండి — యాప్ వెంటనే అనువదించబడుతుంది.',
  selectCityLabel: 'మీ నగరం',
  mapTitle: 'లైవ్ మ్యాప్ & ఆటో GPS లొకేషన్',
  autoDetectGpsBtn: 'నా లొకేషన్ ఆటో-డిటెక్ట్ చేయండి (GPS)',
  authTitle: 'డ్రైవ్ చేసి సంపాదించడానికి సిద్ధమా?',
  navHome: 'హోమ్',
  navEarnings: 'ఆదాయం',
  navRides: 'రైడ్స్',
  navRatings: 'రేటింగ్స్',
  navDashboard: 'డ్యాష్‌బోర్డ్',
  navKyc: 'KYC స్థితి',
  navWallet: 'వాలెట్',
  navSupport: 'సపోర్ట్',
  goOnline: 'ఆన్‌లైన్‌కి వెళ్ళండి',
};

const KN: AppTranslations = {
  ...EN,
  skip: 'ಸ್ಕಿಪ್ ಮಾಡಿ',
  next: 'ಮುಂದೆ',
  back: 'ಹಿಂದೆ',
  continueBtn: 'ಪ್ರಾರಂಭಿಸಿ',
  loginBtn: 'ಮೊಬೈಲ್ OTP ಲಾಗಿನ್',
  signupBtn: 'ಸೈನ್ ಅಪ್ · ಡ್ರೈವರ್ ID ರಚಿಸಿ',
  splashSubtitle: 'ಬೈಕ್, ಆಟೋ ಮತ್ತು ಕ್ಯಾಬ್ ಪಾಲುದಾರರಿಗಾಗಿ',
  bikeTitle: 'ಬೈಕ್ ಟ್ಯಾಕ್ಸಿ ಪಾಲುದಾರ · ವೇಗದ ಸವಾರಿ',
  autoTitle: 'ಆಟೋ ರಿಕ್ಷಾ ಪಾಲುದಾರ · ದೈನಂದಿನ ಬುಕಿಂಗ್',
  cabTitle: 'ಕ್ಯಾಬ್ ಪಾಲುದಾರ · ನಗರ ಮತ್ತು ವಿಮಾನ ನಿಲ್ದಾಣ',
  langLocationTitle: 'ಭಾಷೆ ಮತ್ತು ನಗರವನ್ನು ಆಯ್ಕೆಮಾಡಿ',
  langLocationSubtitle: 'ನಿಮ್ಮ ಭಾರತೀಯ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ — ಸಂಪೂರ್ಣ ಆ್ಯಪ್ ಅನುವಾದವಾಗುತ್ತದೆ.',
  selectCityLabel: 'ನಿಮ್ಮ ನಗರ',
  mapTitle: 'ಲೈವ್ ಮ್ಯಾಪ್ ಮತ್ತು ಆಟೋ GPS ಸ್ಥಳ',
  autoDetectGpsBtn: 'ನನ್ನ ಸ್ಥಳವನ್ನು ಆಟೋ-ಪತ್ತೆಹಚ್ಚಿ (GPS)',
  authTitle: 'ಚಾಲನೆ ಮತ್ತು ಗಳಿಕೆ ಪ್ರಾರಂಭಿಸಿ',
  navHome: 'ಹೋಮ್',
  navEarnings: 'ಗಳಿಕೆ',
  navRides: 'ರೈಡ್ಸ್',
  navRatings: 'ರೇಟಿಂಗ್ಸ್',
  navDashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
  navKyc: 'KYC ಸ್ಥಿತಿ',
  navWallet: 'ವಾಲೆಟ್',
  navSupport: 'ಬೆಂಬಲ',
  goOnline: 'ಆನ್‌ಲೈನ್ ಆಗಿ',
};

const ML: AppTranslations = {
  ...EN,
  skip: 'ഒഴിവാക്കുക',
  next: 'അടുത്തത്',
  back: 'തിരികെ',
  continueBtn: 'ആരംഭിക്കുക',
  loginBtn: 'മൊബൈൽ OTP ലോഗിൻ',
  signupBtn: 'സൈൻ അപ്പ് · ഡ്രൈവർ ID സൃഷ്ടിക്കുക',
  langLocationTitle: 'ഭാഷയും നഗരവും തിരഞ്ഞെടുക്കുക',
  langLocationSubtitle: 'നിങ്ങളുടെ ഇന്ത്യൻ ഭാഷ തിരഞ്ഞെടുക്കുക — ആപ്പ് ഉടൻ വിവർത്തനം ചെയ്യും.',
  mapTitle: 'ലൈവ് മാപ്പും ഓട്ടോ GPS ലൊക്കേഷനും',
  autoDetectGpsBtn: 'എന്റെ ലൊക്കേഷൻ കണ്ടെത്തുക (GPS)',
  navHome: 'ഹോം',
  navEarnings: 'വരുമാനം',
  navRides: 'റൈഡുകൾ',
  navRatings: 'റേറ്റിംഗ്',
  goOnline: 'ഓൺലൈൻ ആകുക',
};

const GU: AppTranslations = {
  ...EN,
  skip: 'છોડો',
  next: 'આગળ',
  back: 'પાછળ',
  continueBtn: 'શરૂ કરો',
  loginBtn: 'મોબાઈલ OTP વડે લૉગિન કરો',
  signupBtn: 'સાઇન અપ · ડ્રાઇવર ID બનાવો',
  langLocationTitle: 'તમારી ભાષા અને શહેર પસંદ કરો',
  langLocationSubtitle: 'કોઈપણ ભારતીય ભાષા પસંદ કરો — આખી એપ તરત અનુવાદિત થશે.',
  mapTitle: 'લાઇવ મેપ અને ઓટો GPS લોકેશન',
  autoDetectGpsBtn: 'મારું લોકેશન ઓટો-ડિટેક્ટ કરો (GPS)',
  navHome: 'હોમ',
  navEarnings: 'કમાણી',
  navRides: 'રાઇડ્સ',
  navRatings: 'રેટિંગ્સ',
  goOnline: 'ઓનલાઈન જાઓ',
};

const PA: AppTranslations = {
  ...EN,
  skip: 'ਛੱਡੋ',
  next: 'ਅੱਗੇ',
  back: 'ਪਿੱਛੇ',
  continueBtn: 'ਸ਼ੁਰੂ ਕਰੋ',
  loginBtn: 'ਮੋਬਾਈਲ OTP ਨਾਲ ਲੌਗਇਨ',
  signupBtn: 'ਸਾਈਨ ਅੱਪ · ਡਰਾਈਵਰ ID ਬਣਾਓ',
  langLocationTitle: 'ਆਪਣੀ ਭਾਸ਼ਾ ਅਤੇ ਸ਼ਹਿਰ ਚੁਣੋ',
  langLocationSubtitle: 'ਕੋਈ ਵੀ ਭਾਰਤੀ ਭਾਸ਼ਾ ਚੁਣੋ — ਪੂਰਾ ਐਪ ਤੁਰੰਤ ਅਨੁਵਾਦ ਹੋਵੇਗਾ।',
  mapTitle: 'ਲਾਈਵ ਮੈਪ ਅਤੇ ਆਟੋ GPS ਲੋਕੇਸ਼ਨ',
  autoDetectGpsBtn: 'ਮੇਰੀ ਲੋਕੇਸ਼ਨ ਆਟੋ-ਖੋਜੋ (GPS)',
  navHome: 'ਹੋਮ',
  navEarnings: 'ਕਮਾਈ',
  navRides: 'ਰਾਈਡਜ਼',
  navRatings: 'ਰੇਟਿੰਗਜ਼',
  goOnline: 'ਆਨਲਾਈਨ ਜਾਓ',
};

const OR: AppTranslations = {
  ...EN,
  skip: 'ଛାଡ଼ନ୍ତୁ',
  next: 'ପରବର୍ତ୍ତୀ',
  back: 'ପଛକୁ',
  continueBtn: 'ଆରମ୍ଭ କରନ୍ତୁ',
  loginBtn: 'ମୋବାଇଲ୍ OTP ଲগଇନ୍',
  signupBtn: 'ସାଇନ୍ ଅପ୍ · ଡ୍ରାଇଭର ID ତିଆରି କରନ୍ତୁ',
  langLocationTitle: 'ଆପଣଙ୍କ ଭାଷା ଏବଂ ସହର ବାଛନ୍ତୁ',
  langLocationSubtitle: 'ଯେକୌଣସି ଭାରତୀୟ ଭାଷା ବାଛନ୍ତୁ — ସମ୍ପୂର୍ଣ୍ଣ ଆପ୍ ଅନୁବାଦ ହେବ।',
  mapTitle: 'ଲାଇଭ୍ ମ୍ୟାପ୍ ଓ ଅଟୋ GPS ଲୋକେସନ୍',
  autoDetectGpsBtn: 'ମୋ ଲୋକେସନ୍ ଅଟୋ-ଡିଟେକ୍ଟ କରନ୍ତୁ (GPS)',
  navHome: 'ହୋମ୍',
  navEarnings: 'ରୋଜଗାର',
  navRides: 'ରାଇଡ୍ସ',
  navRatings: 'ରେଟିଂ',
  goOnline: 'ଅନଲାଇନ୍ ଯାଆନ୍ତୁ',
};

const UR: AppTranslations = {
  ...EN,
  skip: 'چھوڑیں',
  next: 'آگے',
  back: 'واپس',
  continueBtn: 'شروع کریں',
  loginBtn: 'موبائل OTP سے لاگ ان کریں',
  signupBtn: 'سائن اپ · ڈرائیور ID بنائیں',
  langLocationTitle: 'اپنی زبان اور شہر منتخب کریں',
  langLocationSubtitle: 'کوئی بھی ہندوستانی زبان منتخب کریں — پورا ایپ فوراً ترجمہ ہو جائے گا۔',
  mapTitle: 'لائیو میپ اور آٹو GPS لوکیشن',
  autoDetectGpsBtn: 'میری لوکیشن آٹو ڈیٹیکٹ کریں (GPS)',
  navHome: 'ہوم',
  navEarnings: 'کمائی',
  navRides: 'رائیڈز',
  navRatings: 'ریٹنگز',
  goOnline: 'آن لائن جائیں',
};

const AS: AppTranslations = {
  ...EN,
  skip: 'বাদ দিয়ক',
  next: 'পৰৱৰ্তী',
  back: 'পাছলৈ',
  continueBtn: 'আৰম্ভ কৰক',
  loginBtn: 'ম’বাইল OTP ৰে লগইন',
  signupBtn: 'চাইন আপ · ড্ৰাইভাৰ ID বনাওক',
  langLocationTitle: 'আপোনাৰ ভাষা আৰু চহৰ বাছনি কৰক',
  langLocationSubtitle: 'যিকোনো ভাৰতীয় ভাষা বাছনি কৰক — সম্পূৰ্ণ এপ অনুবাদ হ’ব।',
  mapTitle: 'লাইভ মেপ আৰু অট’ GPS অৱস্থান',
  autoDetectGpsBtn: 'মোৰ অৱস্থান অট’-চিনাক্ত কৰক (GPS)',
  navHome: 'হোম',
  navEarnings: 'উপাৰ্জন',
  navRides: 'ৰাইডসমূহ',
  navRatings: 'ৰেটিং',
  goOnline: 'অনলাইন হওক',
};

const TRANSLATION_MAP: Record<IndianLanguageCode, AppTranslations> = {
  en: EN,
  hi: HI,
  hinglish: HINGLISH,
  mr: MR,
  bn: BN,
  ta: TA,
  te: TE,
  kn: KN,
  ml: ML,
  gu: GU,
  pa: PA,
  or: OR,
  ur: UR,
  as: AS,
};

export function getTranslations(code: IndianLanguageCode | string): AppTranslations {
  return TRANSLATION_MAP[code as IndianLanguageCode] ?? EN;
}
