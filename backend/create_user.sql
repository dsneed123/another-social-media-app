-- Create test user with password "password123"
-- Password hash generated with Argon2
INSERT INTO users (id, username, email, password_hash, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'testuser',
    'test@example.com',
    '$argon2id$v=19$m=19456,t=2,p=1$VGhpc0lzQVNhbHQ$Q8xT6F3dTqE7k7hN5YL2Zw',
    NOW()
)
ON CONFLICT (username) DO NOTHING;
