import requests
import sys
import json
import base64
from datetime import datetime
from io import BytesIO
from PIL import Image

class TebbiAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.patient_id = None
        self.invoice_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for file uploads
                    headers.pop('Content-Type', None)
                    response = requests.post(url, data=data, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_seed_data(self):
        """Test seeding initial data"""
        return self.run_test("Seed Data", "POST", "seed", 200)

    def test_login(self, email, password):
        """Test login and get token"""
        success, response = self.run_test(
            "Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response.get('user', {}).get('id')
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_get_me(self):
        """Test getting current user info"""
        return self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        return self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200)

    def test_create_patient(self):
        """Test creating a new patient"""
        patient_data = {
            "name": "Test Patient",
            "name_ar": "مريض تجريبي",
            "national_id": "1234567890",
            "date_of_birth": "1990-01-01",
            "gender": "male",
            "phone": "+963911234567",
            "address": "Damascus, Syria",
            "address_ar": "دمشق، سوريا",
            "blood_type": "A+",
            "emergency_contact": "Emergency Contact",
            "emergency_phone": "+963922345678"
        }
        success, response = self.run_test(
            "Create Patient",
            "POST",
            "patients",
            200,
            data=patient_data
        )
        if success and 'id' in response:
            self.patient_id = response['id']
            print(f"   Patient ID: {self.patient_id}")
            return True
        return False

    def test_get_patients(self):
        """Test getting all patients"""
        return self.run_test("Get Patients", "GET", "patients", 200)

    def test_get_patient_detail(self):
        """Test getting specific patient details"""
        if not self.patient_id:
            print("❌ No patient ID available for detail test")
            return False
        return self.run_test("Get Patient Detail", "GET", f"patients/{self.patient_id}", 200)

    def test_create_allergy(self):
        """Test creating patient allergy"""
        if not self.patient_id:
            print("❌ No patient ID available for allergy test")
            return False
        
        allergy_data = {
            "patient_id": self.patient_id,
            "allergen": "Penicillin",
            "allergen_ar": "البنسلين",
            "severity": "severe",
            "reaction": "Skin rash",
            "reaction_ar": "طفح جلدي"
        }
        return self.run_test("Create Allergy", "POST", "allergies", 200, data=allergy_data)

    def test_create_diagnosis(self):
        """Test creating patient diagnosis"""
        if not self.patient_id:
            print("❌ No patient ID available for diagnosis test")
            return False
        
        diagnosis_data = {
            "patient_id": self.patient_id,
            "doctor_id": self.user_id,
            "diagnosis": "Common Cold",
            "diagnosis_ar": "نزلة برد",
            "notes": "Mild symptoms",
            "notes_ar": "أعراض خفيفة",
            "is_ai_suggested": False
        }
        return self.run_test("Create Diagnosis", "POST", "diagnoses", 200, data=diagnosis_data)

    def test_create_medication(self):
        """Test creating patient medication"""
        if not self.patient_id:
            print("❌ No patient ID available for medication test")
            return False
        
        medication_data = {
            "patient_id": self.patient_id,
            "doctor_id": self.user_id,
            "name": "Paracetamol",
            "name_ar": "باراسيتامول",
            "dosage": "500mg",
            "frequency": "3 times daily",
            "frequency_ar": "3 مرات يومياً",
            "start_date": "2024-01-01",
            "end_date": "2024-01-07",
            "notes": "Take with food"
        }
        return self.run_test("Create Medication", "POST", "medications", 200, data=medication_data)

    def test_create_appointment(self):
        """Test creating an appointment"""
        if not self.patient_id:
            print("❌ No patient ID available for appointment test")
            return False
        
        appointment_data = {
            "patient_id": self.patient_id,
            "doctor_id": self.user_id,
            "date": "2024-12-25",
            "time": "10:00",
            "duration_minutes": 30,
            "reason": "Regular checkup",
            "reason_ar": "فحص دوري",
            "status": "scheduled",
            "notes": "Annual checkup"
        }
        return self.run_test("Create Appointment", "POST", "appointments", 200, data=appointment_data)

    def test_get_appointments(self):
        """Test getting appointments"""
        return self.run_test("Get Appointments", "GET", "appointments", 200)

    def test_create_invoice(self):
        """Test creating an invoice"""
        if not self.patient_id:
            print("❌ No patient ID available for invoice test")
            return False
        
        invoice_data = {
            "patient_id": self.patient_id,
            "items": [
                {
                    "description": "Consultation",
                    "description_ar": "استشارة",
                    "quantity": 1,
                    "unit_price": 100.0,
                    "total": 100.0
                },
                {
                    "description": "Lab Test",
                    "description_ar": "تحليل مخبري",
                    "quantity": 2,
                    "unit_price": 50.0,
                    "total": 100.0
                }
            ],
            "subtotal": 200.0,
            "discount": 20.0,
            "tax": 18.0,
            "total": 198.0,
            "payment_status": "pending",
            "paid_amount": 0.0,
            "notes": "Regular consultation and tests"
        }
        success, response = self.run_test("Create Invoice", "POST", "invoices", 200, data=invoice_data)
        if success and 'id' in response:
            self.invoice_id = response['id']
            print(f"   Invoice ID: {self.invoice_id}")
            return True
        return False

    def test_get_invoices(self):
        """Test getting invoices"""
        return self.run_test("Get Invoices", "GET", "invoices", 200)

    def test_pay_invoice(self):
        """Test paying an invoice"""
        if not self.invoice_id:
            print("❌ No invoice ID available for payment test")
            return False
        
        return self.run_test("Pay Invoice", "PUT", f"invoices/{self.invoice_id}/pay?amount=100", 200)

    def test_create_expense(self):
        """Test creating an expense"""
        expense_data = {
            "category": "supplies",
            "amount": 150.0,
            "description": "Medical supplies",
            "description_ar": "مستلزمات طبية",
            "date": "2024-12-20",
            "receipt_number": "REC-001",
            "notes": "Monthly supplies purchase"
        }
        return self.run_test("Create Expense", "POST", "expenses", 200, data=expense_data)

    def test_get_expenses(self):
        """Test getting expenses"""
        return self.run_test("Get Expenses", "GET", "expenses", 200)

    def test_accounting_summary(self):
        """Test accounting summary"""
        return self.run_test("Accounting Summary", "GET", "accounting/summary", 200)

    def create_test_image(self):
        """Create a simple test image for AI analysis"""
        # Create a simple test image (100x100 white with black text)
        img = Image.new('RGB', (100, 100), color='white')
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"

    def test_ai_symptom_analysis(self):
        """Test AI symptom analysis"""
        symptom_data = {
            "symptoms": ["صداع", "حمى", "سعال"],
            "additional_info": "المريض يعاني من هذه الأعراض منذ 3 أيام",
            "language": "ar"
        }
        print("   Testing Arabic symptom analysis...")
        success, response = self.run_test("AI Symptom Analysis (Arabic)", "POST", "ai/analyze-symptoms", 200, data=symptom_data)
        
        if success:
            # Test English symptoms too
            symptom_data_en = {
                "symptoms": ["headache", "fever", "cough"],
                "additional_info": "Patient has these symptoms for 3 days",
                "language": "en"
            }
            print("   Testing English symptom analysis...")
            return self.run_test("AI Symptom Analysis (English)", "POST", "ai/analyze-symptoms", 200, data=symptom_data_en)
        
        return success

    def test_ai_image_analysis(self):
        """Test AI image analysis"""
        test_image = self.create_test_image()
        
        image_data = {
            "image_base64": test_image,
            "image_type": "xray",
            "notes": "Test X-ray image for analysis",
            "language": "ar"
        }
        print("   Testing medical image analysis...")
        return self.run_test("AI Image Analysis", "POST", "ai/analyze-image", 200, data=image_data)

    def run_all_tests(self):
        """Run all API tests"""
        print("🏥 Starting Tebbi Medical System API Tests")
        print("=" * 50)
        
        # Basic API tests
        self.test_health_check()
        self.test_seed_data()
        
        # Authentication tests
        if not self.test_login("admin@tebbi.com", "admin123"):
            print("❌ Login failed, stopping tests")
            return False
        
        self.test_get_me()
        
        # Dashboard tests
        self.test_dashboard_stats()
        
        # Patient management tests
        self.test_create_patient()
        self.test_get_patients()
        self.test_get_patient_detail()
        
        # Medical records tests
        self.test_create_allergy()
        self.test_create_diagnosis()
        self.test_create_medication()
        
        # Appointment tests
        self.test_create_appointment()
        self.test_get_appointments()
        
        # Billing tests
        self.test_create_invoice()
        self.test_get_invoices()
        self.test_pay_invoice()
        
        # Accounting tests
        self.test_create_expense()
        self.test_get_expenses()
        self.test_accounting_summary()
        
        # AI tests (these might fail if no internet or API key issues)
        print("\n🤖 Testing AI Features (requires internet)...")
        self.test_ai_symptom_analysis()
        self.test_ai_image_analysis()
        
        # Print results
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = TebbiAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())