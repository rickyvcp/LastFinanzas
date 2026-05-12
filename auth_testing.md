# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var visitorId = 'user_' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: visitorId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: visitorId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + visitorId);
"
```

## Step 2: Backend API Tests
```bash
curl -X GET "$EXPO_BACKEND_URL/api/auth/me" \
  -H "Authorization: Bearer SESSION_TOKEN"
```

## Step 3: Browser Testing
Set cookie `session_token` on domain and navigate. Note we ALSO accept Authorization header for mobile/native.

## Notes
- Backend uses **dual auth**: JWT email/password OR Emergent Google session_token.
- Both flows use same `get_current_user` helper.
- Sessions stored in `user_sessions` collection with timezone-aware expiry.
