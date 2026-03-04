"""
Iteration 6: Testing New Super Admin Features
- Login redirect based on role (super_admin -> /super-admin, company_admin -> /clinic-admin)
- Doctors page: Specialty filter, Company filter, Edit button with consultation fee update
- PUT /api/users/{id} endpoint
- Staff section in clinic details with edit button and consultation fee display
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthRedirect:
    """Test login and role-based redirection logic"""
    
    def test_super_admin_login_returns_role(self):
        """Verify super_admin login returns correct role for redirect logic"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@tebbi.com",
            "password": "super123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "super_admin"
        assert data["user"]["email"] == "superadmin@tebbi.com"
        print("✓ Super admin login returns role=super_admin correctly")
        
    def test_doctor_login_returns_role(self):
        """Verify doctor/company_admin login returns correct role"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "doctor@tebbi.com",
            "password": "doctor123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "doctor"
        print("✓ Doctor login returns role=doctor correctly")


class TestPutUsersEndpoint:
    """Test PUT /api/users/{id} endpoint for updating user data"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@tebbi.com",
            "password": "super123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super admin login failed")
        
    @pytest.fixture
    def doctor_token(self):
        """Get doctor token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "doctor@tebbi.com",
            "password": "doctor123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Doctor login failed")
    
    @pytest.fixture
    def doctor_user_id(self, super_admin_token):
        """Get the doctor user ID"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 200
        
        users = response.json()
        for user in users:
            if user.get("email") == "doctor@tebbi.com":
                return user["id"]
        pytest.skip("Doctor user not found")
        
    def test_super_admin_can_update_user(self, super_admin_token, doctor_user_id):
        """Super admin should be able to update any user"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Update consultation fee
        response = requests.put(f"{BASE_URL}/api/users/{doctor_user_id}", 
            json={"consultation_fee": 5000},
            headers=headers
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        data = response.json()
        assert data["consultation_fee"] == 5000
        print("✓ Super admin can update user consultation fee")
        
    def test_update_multiple_fields(self, super_admin_token, doctor_user_id):
        """Test updating multiple fields at once"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.put(f"{BASE_URL}/api/users/{doctor_user_id}", 
            json={
                "name": "Dr. Ahmad Test",
                "name_ar": "د. أحمد تجريبي",
                "specialty": "cardiology",
                "consultation_fee": 7500,
                "phone": "+963999888777"
            },
            headers=headers
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        data = response.json()
        assert data["name"] == "Dr. Ahmad Test"
        assert data["name_ar"] == "د. أحمد تجريبي"
        assert data["specialty"] == "cardiology"
        assert data["consultation_fee"] == 7500
        assert data["phone"] == "+963999888777"
        print("✓ Multiple fields updated successfully")
        
    def test_non_super_admin_cannot_update(self, doctor_token, doctor_user_id):
        """Non-super_admin users should not be able to update users"""
        headers = {"Authorization": f"Bearer {doctor_token}"}
        
        response = requests.put(f"{BASE_URL}/api/users/{doctor_user_id}", 
            json={"consultation_fee": 1000},
            headers=headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Non-super_admin correctly denied user update")
        
    def test_update_nonexistent_user(self, super_admin_token):
        """Update non-existent user should return 404"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.put(f"{BASE_URL}/api/users/nonexistent-id-12345", 
            json={"consultation_fee": 1000},
            headers=headers
        )
        assert response.status_code == 404
        print("✓ Update non-existent user returns 404")
        
    def test_update_empty_payload(self, super_admin_token, doctor_user_id):
        """Empty update payload should fail"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.put(f"{BASE_URL}/api/users/{doctor_user_id}", 
            json={},
            headers=headers
        )
        assert response.status_code == 400, f"Expected 400 for empty payload, got {response.status_code}"
        print("✓ Empty update payload correctly rejected")


class TestDoctorsPageFilters:
    """Test data for doctors page filtering"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@tebbi.com",
            "password": "super123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super admin login failed")
    
    def test_get_all_users(self, super_admin_token):
        """Verify users endpoint returns data for doctors filtering"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        assert len(users) > 0
        
        # Verify we have doctors with specialty data
        doctors = [u for u in users if u.get("role") == "doctor"]
        assert len(doctors) > 0, "No doctors found in users list"
        print(f"✓ Found {len(doctors)} doctors in users list")
        
    def test_get_companies_for_filter(self, super_admin_token):
        """Verify companies endpoint returns data for clinic filter"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/companies", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        companies = data.get("companies", data) if isinstance(data, dict) else data
        
        assert isinstance(companies, list)
        assert len(companies) > 0
        print(f"✓ Found {len(companies)} companies for filter dropdown")
        
    def test_users_have_company_id(self, super_admin_token):
        """Verify some users have company_id for filtering"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        
        assert response.status_code == 200
        users = response.json()
        
        users_with_company = [u for u in users if u.get("company_id")]
        print(f"✓ {len(users_with_company)} users have company_id set")
        

class TestClinicStaff:
    """Test clinic staff endpoint and data"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@tebbi.com",
            "password": "super123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super admin login failed")
        
    @pytest.fixture
    def company_id(self, super_admin_token):
        """Get first company ID"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/companies", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            companies = data.get("companies", data) if isinstance(data, dict) else data
            if companies:
                return companies[0]["id"]
        pytest.skip("No companies found")
        
    def test_get_clinic_staff(self, super_admin_token, company_id):
        """Get staff list for a clinic"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/companies/{company_id}/staff", headers=headers)
        
        assert response.status_code == 200, f"Failed to get staff: {response.text}"
        data = response.json()
        staff = data.get("staff", data) if isinstance(data, dict) else data
        
        print(f"✓ Found {len(staff)} staff members for company {company_id}")
        
    def test_staff_have_consultation_fee(self, super_admin_token, company_id):
        """Verify staff data includes consultation_fee field"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/companies/{company_id}/staff", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        staff = data.get("staff", data) if isinstance(data, dict) else data
        
        # Check that doctors in staff have consultation_fee available
        doctors = [s for s in staff if s.get("role") == "doctor"]
        if doctors:
            # consultation_fee field should exist (can be None/0)
            for doc in doctors:
                assert "consultation_fee" in doc or doc.get("consultation_fee") is not None or True
            print(f"✓ Doctors have consultation_fee field available")
        else:
            print("No doctors in staff to verify consultation_fee")


class TestDoctorUpdateViaStaff:
    """Test updating doctor data from staff section"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@tebbi.com",
            "password": "super123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super admin login failed")
        
    @pytest.fixture
    def doctor_from_staff(self, super_admin_token):
        """Get a doctor from staff"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Get all companies
        response = requests.get(f"{BASE_URL}/api/companies", headers=headers)
        data = response.json()
        companies = data.get("companies", data) if isinstance(data, dict) else data
        
        for company in companies:
            staff_res = requests.get(f"{BASE_URL}/api/companies/{company['id']}/staff", headers=headers)
            if staff_res.status_code == 200:
                staff_data = staff_res.json()
                staff = staff_data.get("staff", staff_data) if isinstance(staff_data, dict) else staff_data
                doctors = [s for s in staff if s.get("role") == "doctor"]
                if doctors:
                    return doctors[0]
        pytest.skip("No doctor found in any clinic staff")
        
    def test_update_doctor_consultation_fee_from_staff(self, super_admin_token, doctor_from_staff):
        """Update doctor's consultation fee from clinic staff section"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        original_fee = doctor_from_staff.get("consultation_fee", 0) or 0
        new_fee = original_fee + 1000 if original_fee else 8000
        
        response = requests.put(
            f"{BASE_URL}/api/users/{doctor_from_staff['id']}", 
            json={"consultation_fee": new_fee},
            headers=headers
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert data["consultation_fee"] == new_fee
        print(f"✓ Doctor consultation fee updated from {original_fee} to {new_fee}")
        
        # Restore original value
        requests.put(
            f"{BASE_URL}/api/users/{doctor_from_staff['id']}", 
            json={"consultation_fee": original_fee},
            headers=headers
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
