import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { createUserAuth } from '../gateway/Auth.js';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  nickname: string;
}

interface AuthResult {
  success: boolean;
  token?: string;
  nickname?: string;
  userId?: string;
  error?: string;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const { email, password, firstName, lastName, nickname } = input;

  // Validate
  if (!email || !password || !firstName || !lastName || !nickname) {
    return { success: false, error: 'All fields are required' };
  }
  if (password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters' };
  }
  if (nickname.length < 2 || nickname.length > 16) {
    return { success: false, error: 'Nickname must be 2-16 characters' };
  }
  if (!/^[a-zA-Z0-9_ \-]+$/.test(nickname)) {
    return { success: false, error: 'Nickname can only contain letters, numbers, spaces, _ and -' };
  }

  // Check if email or nickname already taken
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { nickname }] },
  });
  if (existing) {
    if (existing.email === email.toLowerCase()) {
      return { success: false, error: 'Email already registered' };
    }
    return { success: false, error: 'Nickname already taken' };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      nickname: nickname.trim(),
    },
  });

  const { token } = createUserAuth(user.id, user.nickname);
  return { success: true, token, nickname: user.nickname, userId: user.id };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { success: false, error: 'Invalid email or password' };
  }

  const { token } = createUserAuth(user.id, user.nickname);
  return { success: true, token, nickname: user.nickname, userId: user.id };
}

export async function forgotPassword(email: string): Promise<{ success: boolean; error?: string }> {
  if (!email) {
    return { success: false, error: 'Email is required' };
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    // Don't reveal whether email exists
    return { success: true };
  }

  const resetToken = randomBytes(32).toString('hex');
  const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetExpiry },
  });

  // TODO: Send email with reset link. For now, log to console.
  console.log(`\n🔑 Password reset for ${user.email}:`);
  console.log(`   Token: ${resetToken}`);
  console.log(`   Link: http://localhost:3000/reset?token=${resetToken}\n`);

  return { success: true };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!token || !newPassword) {
    return { success: false, error: 'Token and new password are required' };
  }
  if (newPassword.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters' };
  }

  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetExpiry: { gt: new Date() } },
  });
  if (!user) {
    return { success: false, error: 'Invalid or expired reset token' };
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetExpiry: null },
  });

  return { success: true };
}

export async function getUserByNickname(nickname: string) {
  return prisma.user.findUnique({ where: { nickname } });
}
