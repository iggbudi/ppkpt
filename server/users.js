const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('./db');

const NODE_ENV = process.env.NODE_ENV || 'development';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin PPKS';

const passwordSchema = z.string().min(6).max(200).refine((value) => (
  /[A-Z]/.test(value)
  && /\d/.test(value)
  && /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/.test(value)
), { message: 'Password harus memiliki huruf kapital, angka, dan karakter spesial' });

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  password: passwordSchema,
  status: z.enum(['Mahasiswa', 'Umum', 'Lainnya']),
  instansi: z.string().trim().max(200).optional(),
  peran: z.string().trim().max(200).optional()
}).superRefine((data, ctx) => {
  if ((data.status === 'Mahasiswa' || data.status === 'Umum') && (!data.instansi || !data.peran)) {
    ctx.addIssue({ code: 'custom', message: 'Instansi dan peran wajib diisi', path: ['instansi'] });
  }
});

const adminCreateUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  password: passwordSchema,
  role: z.enum(['admin', 'user']).default('user'),
  status: z.enum(['Mahasiswa', 'Umum', 'Lainnya']).optional(),
  instansi: z.string().trim().max(200).optional(),
  peran: z.string().trim().max(200).optional()
});

const selectByLogin = db.prepare(`
  SELECT * FROM users
  WHERE active = 1 AND (LOWER(username) = ? OR LOWER(email) = ?)
`);

const selectByEmail = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?');
const selectByUsername = db.prepare('SELECT * FROM users WHERE LOWER(username) = ?');
const selectById = db.prepare('SELECT * FROM users WHERE id = ?');
const selectAllUsers = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
const insertUser = db.prepare(`
  INSERT INTO users (username, email, password_hash, role, name, status, instansi, peran, active, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
`);
const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
const deactivateUser = db.prepare('UPDATE users SET active = 0, deactivated_at = ? WHERE id = ?');

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function mapUserForSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    name: row.name
  };
}

function mapUserForApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    name: row.name,
    status: row.status,
    instansi: row.instansi,
    peran: row.peran,
    active: row.active === 1,
    createdAt: row.created_at,
    deactivatedAt: row.deactivated_at
  };
}

function verifyPassword(row, password) {
  return row && bcrypt.compareSync(password, row.password_hash);
}

function findUserByLogin(identifier) {
  const normalized = String(identifier).trim().toLowerCase();
  return selectByLogin.get(normalized, normalized);
}

function upsertSystemUser({ username, email, password, role, name }) {
  const normalizedUsername = String(username).trim().toLowerCase();
  const normalizedEmail = email ? normalizeEmail(email) : null;
  const passwordHash = bcrypt.hashSync(password, 10);
  const existing = selectByUsername.get(normalizedUsername);

  if (existing) {
    updatePassword.run(passwordHash, existing.id);
    return existing.id;
  }

  const result = insertUser.run(
    normalizedUsername,
    normalizedEmail,
    passwordHash,
    role,
    name,
    null,
    null,
    null,
    Date.now()
  );
  return Number(result.lastInsertRowid);
}

function bootstrapSystemUsers() {
  if (ADMIN_USERNAME && ADMIN_PASSWORD) {
    upsertSystemUser({
      username: ADMIN_USERNAME,
      email: null,
      password: ADMIN_PASSWORD,
      role: 'admin',
      name: ADMIN_NAME
    });
  }

  if (NODE_ENV === 'development' || NODE_ENV === 'test') {
    upsertSystemUser({
      username: 'demo',
      email: 'demo@local',
      password: 'demo123',
      role: 'user',
      name: 'Demo User'
    });
  }
}

function createRegisteredUser(data) {
  const parsed = registerSchema.parse(data);
  const email = normalizeEmail(parsed.email);
  const username = email;

  if (selectByEmail.get(email) || selectByUsername.get(username)) {
    const err = new Error('Email sudah terdaftar');
    err.status = 409;
    throw err;
  }

  const passwordHash = bcrypt.hashSync(parsed.password, 10);
  const result = insertUser.run(
    username,
    email,
    passwordHash,
    'user',
    parsed.name,
    parsed.status,
    parsed.instansi || null,
    parsed.peran || null,
    Date.now()
  );

  return mapUserForApi(selectById.get(Number(result.lastInsertRowid)));
}

function createUserByAdmin(data) {
  const parsed = adminCreateUserSchema.parse(data);
  const email = normalizeEmail(parsed.email);
  const username = email;

  if (selectByEmail.get(email) || selectByUsername.get(username)) {
    const err = new Error('Email sudah terdaftar');
    err.status = 409;
    throw err;
  }

  const passwordHash = bcrypt.hashSync(parsed.password, 10);
  const result = insertUser.run(
    username,
    email,
    passwordHash,
    parsed.role,
    parsed.name,
    parsed.status || null,
    parsed.instansi || null,
    parsed.peran || null,
    Date.now()
  );

  return mapUserForApi(selectById.get(Number(result.lastInsertRowid)));
}

function listUsers() {
  return selectAllUsers.all().map(mapUserForApi);
}

function deactivateUserById(userId) {
  const row = selectById.get(userId);
  if (!row) {
    const err = new Error('User tidak ditemukan');
    err.status = 404;
    throw err;
  }
  if (row.active !== 1) {
    const err = new Error('User sudah nonaktif');
    err.status = 400;
    throw err;
  }
  deactivateUser.run(Date.now(), userId);
  return mapUserForApi(selectById.get(userId));
}

bootstrapSystemUsers();

module.exports = {
  registerSchema,
  adminCreateUserSchema,
  passwordSchema,
  bootstrapSystemUsers,
  findUserByLogin,
  verifyPassword,
  mapUserForSession,
  mapUserForApi,
  createRegisteredUser,
  createUserByAdmin,
  listUsers,
  deactivateUserById
};