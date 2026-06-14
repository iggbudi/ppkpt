process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET ||= 'test-session-secret-at-least-32-characters';
process.env.ADMIN_USERNAME ||= 'testadmin';
process.env.ADMIN_PASSWORD ||= 'testpassword123';
process.env.EVIDENCE_UPLOADS_ENABLED = 'true';
process.env.TRUST_PROXY = '';
