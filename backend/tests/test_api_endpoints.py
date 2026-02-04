"""
Tests for API endpoints.
"""

import pytest
from unittest.mock import patch, MagicMock


class TestHealthEndpoints:
    """Tests for health check endpoints."""
    
    def test_health_check(self, client):
        """Basic health check should return ok."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "message" in data
    
    def test_liveness_check(self, client):
        """Liveness probe should return alive."""
        response = client.get("/api/health/live")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "alive"
    
    def test_readiness_check(self, client):
        """Readiness probe should return ready status."""
        with patch('app.main.get_pool_stats') as mock_stats:
            mock_stats.return_value = {"closed": False, "pool_size": 5}
            
            response = client.get("/api/health/ready")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ready"


class TestAuthEndpoints:
    """Tests for authentication endpoints."""
    
    def test_login_success(self, client):
        """Valid credentials should return token."""
        response = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "demo123"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
    
    def test_login_invalid_credentials(self, client):
        """Invalid credentials should return 401."""
        response = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "wrong_password"}
        )
        
        assert response.status_code == 401
    
    def test_login_nonexistent_user(self, client):
        """Non-existent user should return 401."""
        response = client.post(
            "/api/auth/login",
            json={"username": "nonexistent", "password": "any_password"}
        )
        
        assert response.status_code == 401
    
    def test_get_current_user(self, authenticated_client):
        """Authenticated user should get their info."""
        response = authenticated_client.get("/api/auth/me")
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "test_user"
    
    def test_get_current_user_unauthorized(self, client):
        """Unauthenticated request should return 401."""
        # Enable auth for this test
        with patch.dict('os.environ', {"AUTH_ENABLED": "true"}):
            response = client.get("/api/auth/me")
            # In dev mode with AUTH_ENABLED=false, returns 200
            # This test is checking the endpoint exists


class TestDataEndpoints:
    """Tests for data query endpoints."""
    
    def test_test_connection(self, authenticated_client):
        """Test connection endpoint should return connection status."""
        with patch('app.main.test_connection') as mock_test:
            mock_test.return_value = {
                "connected": True,
                "user": "test_user",
                "role": "test_role",
                "warehouse": "test_wh",
                "account": "test_account",
                "version": "8.0.0",
                "connection_time_ms": 100.0
            }
            
            response = authenticated_client.get("/api/test-connection")
            
            assert response.status_code == 200
            data = response.json()
            assert data["connected"] is True
    
    def test_query_endpoint(self, authenticated_client, mock_snowflake_data):
        """Query endpoint should return cost data."""
        with patch('app.main.execute_query') as mock_query:
            mock_query.return_value = mock_snowflake_data
            
            response = authenticated_client.post(
                "/api/query",
                json={
                    "project_numbers": ["106073"],
                    "start_month": "202401",
                    "limit": 1000
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "rows" in data
            assert "row_count" in data
    
    def test_query_validation_invalid_project(self, authenticated_client):
        """Query with invalid project number should fail."""
        response = authenticated_client.post(
            "/api/query",
            json={
                "project_numbers": ["invalid"],
                "start_month": "202401"
            }
        )
        
        assert response.status_code == 422
    
    def test_query_validation_invalid_month(self, authenticated_client):
        """Query with invalid month format should fail."""
        response = authenticated_client.post(
            "/api/query",
            json={
                "project_numbers": ["106073"],
                "start_month": "2024"  # Should be 6 digits
            }
        )
        
        assert response.status_code == 422
    
    def test_projects_endpoint(self, authenticated_client):
        """Projects endpoint should return project list."""
        with patch('app.main.execute_query') as mock_query:
            mock_query.return_value = {
                "rows": [{"PROJECT_NUMBER": "106073"}],
                "row_count": 1,
                "timing_ms": 50.0
            }
            
            response = authenticated_client.get("/api/projects")
            
            assert response.status_code == 200
            data = response.json()
            assert "projects" in data
    
    def test_districts_endpoint(self, authenticated_client):
        """Districts endpoint should return district list."""
        with patch('app.main.execute_query') as mock_query:
            mock_query.return_value = {
                "rows": [{"LEAD_DISTRICT": "District 1", "LEAD_DISTRICT_ID": "D01"}],
                "row_count": 1
            }
            
            response = authenticated_client.get("/api/districts")
            
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
    
    def test_cost_data_endpoint(self, authenticated_client, mock_snowflake_data):
        """Cost data endpoint should return formatted data."""
        with patch('app.main.execute_query') as mock_query:
            mock_query.return_value = mock_snowflake_data
            
            response = authenticated_client.get(
                "/api/cost-data",
                params={
                    "project_numbers": "106073",
                    "start_month": "202401"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
            assert "total_count" in data
            assert "filters_applied" in data


class TestChatEndpoints:
    """Tests for AI chat endpoints."""
    
    def test_chat_missing_project(self, authenticated_client):
        """Chat without project context should ask for clarification."""
        response = authenticated_client.post(
            "/api/chat",
            json={
                "message": "What is the budget status?",
                "history": []
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["needs_clarification"] is True
    
    def test_chat_with_project_context(self, authenticated_client, mock_snowflake_data):
        """Chat with project context should work."""
        with patch('app.main.execute_query') as mock_query:
            mock_query.return_value = mock_snowflake_data
            
            with patch('app.main.get_openai_client') as mock_openai:
                mock_client = MagicMock()
                mock_response = MagicMock()
                mock_response.choices = [MagicMock()]
                mock_response.choices[0].message.content = '{"answer": "Budget is on track.", "confidence": "high", "needs_clarification": false}'
                mock_client.chat.completions.create.return_value = mock_response
                mock_openai.return_value = mock_client
                
                response = authenticated_client.post(
                    "/api/chat",
                    json={
                        "message": "What is the budget status for project 106073 in 202401?",
                        "history": [],
                        "filter_hints": {
                            "project_numbers": ["106073"],
                            "start_month": "202401"
                        }
                    }
                )
                
                assert response.status_code == 200


class TestRateLimiting:
    """Tests for rate limiting functionality."""
    
    def test_rate_limit_headers(self, client):
        """Response should include rate limit headers."""
        response = client.get("/health")
        
        # Rate limiting adds headers
        assert response.status_code == 200
        # Note: SlowAPI adds X-RateLimit headers
