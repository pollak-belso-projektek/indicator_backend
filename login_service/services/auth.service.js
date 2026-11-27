import { hashPassword, comparePassword } from "../utils/hash.js";
import { generateToken, verifyRefreshToken, generateTrustedDeviceToken, verifyTrustedDeviceToken } from "../utils/token.js";
import { getByEmail, getById, updateUser } from "./user.service.js";
import { sendTemporaryPasswordEmail } from "../utils/mailer.js";

import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { OAuth2Client } from "google-auth-library";
import { randomInt } from "node:crypto";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


export async function login(email, password, twoFactorCode, trustDevice, trustedDeviceToken) {
  try {
    // Get user data
    const user = await getByEmail(email.toLowerCase());

    if (!user) {
      throw new Error("Hibás email vagy jelszó");
    }


    // Password comparison is inherently slow for security
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Hibás email vagy jelszó");
    }

    // Checked after the password so the account state is not revealed to strangers.
    if (!user.isActive) {
      throw new Error("A fiók inaktív");
    }

    // Check trusted device token
    let isTrusted = false;
    if (trustedDeviceToken) {
      const decoded = verifyTrustedDeviceToken(trustedDeviceToken);
      if (decoded && String(decoded.id) === String(user.id)) {
        isTrusted = true;
      }
    }

    let generatedTrustedToken = null;

    // Check 2FA
    if (user.isTwoFactorEnabled && !isTrusted) {
      if (!twoFactorCode) {
        return { requires2FA: true, userId: user.id };
      }

      const isValid2FA = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1
      });

      if (!isValid2FA) {
        throw new Error("Hibás kétlépcsős kód");
      }

      if (trustDevice) {
        generatedTrustedToken = generateTrustedDeviceToken(user);
      }
    }

    // Generate token
    const token = generateToken(user);

    if (!token) {
      throw new Error("Failed to generate token");
    }

    // Return only necessary data
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      permissions: user.permissions,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      mustChangePassword: user.mustChangePassword || false,
      ...(generatedTrustedToken && { trustedDeviceToken: generatedTrustedToken })
    };
  } catch (error) {
    // Improve error handling
    console.error("Login error:", error.message);
    throw error; // Re-throw to be handled by the controller
  }
}

export async function googleLogin(idToken, trustDevice, trustedDeviceToken, twoFactorCode) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;

    if (!email) {
      throw new Error("Nem sikerült lekérni az email címet a Google fiókból.");
    }

    const user = await getByEmail(email.toLowerCase());

    if (!user) {
      throw new Error("Nincs regisztrált fiók ezzel az email címmel.");
    }

    if (!user.isActive) {
      throw new Error("A fiók inaktív.");
    }

    // Check trusted device token
    let isTrusted = false;
    if (trustedDeviceToken) {
      const decoded = verifyTrustedDeviceToken(trustedDeviceToken);
      if (decoded && String(decoded.id) === String(user.id)) {
        isTrusted = true;
      }
    }

    let generatedTrustedToken = null;

    // Check 2FA
    if (user.isTwoFactorEnabled && !isTrusted) {
      if (!twoFactorCode) {
        return { requires2FA: true, userId: user.id, isGoogleLogin: true, idToken }; 
      }

      const isValid2FA = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1
      });

      if (!isValid2FA) {
        throw new Error("Hibás kétlépcsős kód");
      }
    }

    if (trustDevice) {
      generatedTrustedToken = generateTrustedDeviceToken(user);
    }

    // Generate token
    const token = generateToken(user);

    if (!token) {
      throw new Error("Failed to generate token");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      permissions: user.permissions,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      mustChangePassword: user.mustChangePassword || false,
      ...(generatedTrustedToken && { trustedDeviceToken: generatedTrustedToken })
    };
  } catch (error) {
    console.error("Google Login error:", error.message);
    throw error;
  }
}

export async function refresh(refreshToken) {
  try {
    if (!refreshToken) {
      throw new Error("Refresh token is required");
    }

    const decoded = await verifyRefreshToken(refreshToken);

    if (!decoded) {
      throw new Error("Invalid or expired refresh token");
    }

    // Get fresh user data
    const user = await getById(decoded.id);

    if (!user) {
      throw new Error("User not found");
    }

    // An inactivated account must not keep its session alive with an old refresh token.
    if (!user.isActive) {
      throw new Error("A fiók inaktív");
    }

    // Generate new tokens
    const newTokens = generateToken(user);

    if (!newTokens) {
      throw new Error("Failed to generate new tokens");
    }

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    };
  } catch (error) {
    console.error("Token refresh error:", error.message);
    throw error; // Re-throw to be handled by the controller
  }
}

export async function generate2FA(userId) {
  try {
    const user = await getById(userId);
    if (!user) throw new Error("User not found");

    // Replacing the secret of an active 2FA would let anyone holding an access
    // token silently take over the second factor. It must be disabled first.
    if (user.isTwoFactorEnabled) {
      throw new Error("A kétlépcsős azonosítás már be van kapcsolva.");
    }

    const secret = speakeasy.generateSecret({
      name: `Indicator App (${user.email})`
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    await updateUser(userId, { twoFactorSecret: secret.base32 });

    return { secret: secret.base32, qrCodeUrl };
  } catch (error) {
    console.error("Generate 2FA error:", error.message);
    throw error;
  }
}

export async function verify2FA(userId, token) {
  try {
    const user = await getById(userId);
    if (!user) throw new Error("User not found");
    if (!user.twoFactorSecret) throw new Error("2FA secret nem található. Generálj újat először.");

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!isValid) throw new Error("Hibás kód!");

    await updateUser(userId, { isTwoFactorEnabled: true });

    return { success: true };
  } catch (error) {
    console.error("Verify 2FA error:", error.message);
    throw error;
  }
}

export async function disable2FA(userId) {
  try {
    const user = await getById(userId);
    if (!user) throw new Error("User not found");

    await updateUser(userId, {
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
    });

    return { success: true };
  } catch (error) {
    console.error("Disable 2FA error:", error.message);
    throw error;
  }
}

/**
 * Generates a random temporary password meeting specific criteria.
 * @returns {string}
 */
export function generateTemporaryPassword() {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const specials = "!@#$%^&*()_+~`|}{[]:;?><,./-=";

  let password = "";
  password += lowercase[randomInt(lowercase.length)];
  password += uppercase[randomInt(uppercase.length)];
  password += numbers[randomInt(numbers.length)];
  password += specials[randomInt(specials.length)];

  const allChars = lowercase + uppercase + numbers + specials;
  for (let i = password.length; i < 12; i++) {
    password += allChars[randomInt(allChars.length)];
  }

  // Shuffle the password characters
  // Fisher-Yates shuffle with a cryptographically secure RNG.
  const chars = password.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Handles the forgot password request.
 * Generates a temporary password, saves it hashed, flags mustChangePassword, and emails the user.
 * 
 * @param {string} email 
 */
export async function forgotPassword(email) {
  try {
    const user = await getByEmail(email.toLowerCase());

    if (!user) {
      // Simulate hashing time to prevent timing attacks
      await hashPassword("dummy_password_for_timing_attack_prevention");
      return; // Act as if it succeeded
    }

    const tempPassword = generateTemporaryPassword();
    const hashedPassword = await hashPassword(tempPassword);

    await updateUser(user.id, {
      password: hashedPassword,
      mustChangePassword: true,
    });

    // Send email asynchronously without awaiting to ensure consistent response time
    sendTemporaryPasswordEmail(user.email, user.name, tempPassword).catch(err => {
      console.error("Failed to send temporary password email:", err);
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    throw error;
  }
}
