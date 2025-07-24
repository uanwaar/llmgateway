/**
 * Cryptographic utilities
 * 
 * Provides secure key encryption and storage capabilities
 */

const crypto = require('crypto');
const logger = require('./logger');

// Default encryption configuration
const DEFAULT_ALGORITHM = 'aes-256-gcm';
const DEFAULT_KEY_LENGTH = 32;
const DEFAULT_IV_LENGTH = 12;
// const DEFAULT_TAG_LENGTH = 16;
const DEFAULT_SALT_LENGTH = 32;
const DEFAULT_ITERATIONS = 100000;

/**
 * Generate a random key
 */
function generateKey(length = DEFAULT_KEY_LENGTH) {
  return crypto.randomBytes(length);
}

/**
 * Generate a random initialization vector
 */
function generateIV(length = DEFAULT_IV_LENGTH) {
  return crypto.randomBytes(length);
}

/**
 * Generate a random salt
 */
function generateSalt(length = DEFAULT_SALT_LENGTH) {
  return crypto.randomBytes(length);
}

/**
 * Derive key from password using PBKDF2
 */
function deriveKey(password, salt, iterations = DEFAULT_ITERATIONS, 
  keyLength = DEFAULT_KEY_LENGTH) {
  return crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha512');
}

/**
 * Encrypt data using AES-256-GCM
 */
function encrypt(data, key, algorithm = DEFAULT_ALGORITHM) {
  try {
    const iv = generateIV();
    const cipher = crypto.createCipher(algorithm, key, { iv });
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm,
    };
  } catch (error) {
    logger.error('Encryption failed', {
      error: error.message,
      algorithm,
    });
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
function decrypt(encryptedData, key, algorithm = DEFAULT_ALGORITHM) {
  try {
    const { encrypted, iv, tag } = encryptedData;
    
    const decipher = crypto.createDecipher(algorithm, key, {
      iv: Buffer.from(iv, 'hex'),
    });
    
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', {
      error: error.message,
      algorithm,
    });
    throw new Error('Decryption failed');
  }
}

/**
 * Encrypt data with password
 */
function encryptWithPassword(data, password, iterations = DEFAULT_ITERATIONS) {
  try {
    const salt = generateSalt();
    const key = deriveKey(password, salt, iterations);
    const result = encrypt(data, key);
    
    return {
      ...result,
      salt: salt.toString('hex'),
      iterations,
    };
  } catch (error) {
    logger.error('Password-based encryption failed', {
      error: error.message,
    });
    throw new Error('Password-based encryption failed');
  }
}

/**
 * Decrypt data with password
 */
function decryptWithPassword(encryptedData, password) {
  try {
    const { salt, iterations } = encryptedData;
    const key = deriveKey(password, Buffer.from(salt, 'hex'), iterations);
    
    return decrypt(encryptedData, key);
  } catch (error) {
    logger.error('Password-based decryption failed', {
      error: error.message,
    });
    throw new Error('Password-based decryption failed');
  }
}

/**
 * Hash a string using specified algorithm
 */
function hashString(str, algorithm = 'sha256') {
  try {
    return crypto.createHash(algorithm).update(str, 'utf8').digest('hex');
  } catch (error) {
    logger.error('String hashing failed', {
      error: error.message,
      algorithm,
    });
    throw new Error('String hashing failed');
  }
}

/**
 * Hash a string with salt
 */
function hashWithSalt(str, salt, algorithm = 'sha256') {
  try {
    const hash = crypto.createHash(algorithm);
    hash.update(str);
    hash.update(salt);
    return hash.digest('hex');
  } catch (error) {
    logger.error('Salted hashing failed', {
      error: error.message,
      algorithm,
    });
    throw new Error('Salted hashing failed');
  }
}

/**
 * Generate HMAC signature
 */
function generateHMAC(data, secret, algorithm = 'sha256') {
  try {
    return crypto.createHmac(algorithm, secret).update(data).digest('hex');
  } catch (error) {
    logger.error('HMAC generation failed', {
      error: error.message,
      algorithm,
    });
    throw new Error('HMAC generation failed');
  }
}

/**
 * Verify HMAC signature
 */
function verifyHMAC(data, signature, secret, algorithm = 'sha256') {
  try {
    const expectedSignature = generateHMAC(data, secret, algorithm);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch (error) {
    logger.error('HMAC verification failed', {
      error: error.message,
      algorithm,
    });
    return false;
  }
}

/**
 * Generate a secure random token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a UUID v4
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Generate API key with specific format
 */
function generateApiKey(prefix = 'gw', length = 32) {
  const randomPart = crypto.randomBytes(length).toString('hex');
  return `${prefix}_${randomPart}`;
}

/**
 * Mask sensitive data for logging
 */
function maskSensitiveData(data, visibleChars = 4) {
  if (!data || typeof data !== 'string') {
    return data;
  }

  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }

  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  const masked = '*'.repeat(data.length - visibleChars * 2);

  return `${start}${masked}${end}`;
}

/**
 * Validate API key format
 */
function validateApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // Check minimum length
  if (apiKey.length < 16) {
    return false;
  }

  // Check for valid characters (alphanumeric, hyphens, underscores)
  const validFormat = /^[a-zA-Z0-9_-]+$/.test(apiKey);
  return validFormat;
}

/**
 * Generate secure session token
 */
function generateSessionToken() {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  const combined = `${timestamp}_${random}`;
  
  return Buffer.from(combined).toString('base64');
}

/**
 * Validate and parse session token
 */
function parseSessionToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [timestamp, random] = decoded.split('_');
    
    if (!timestamp || !random) {
      return null;
    }

    return {
      timestamp: parseInt(timestamp, 10),
      random,
      isExpired: (Date.now() - parseInt(timestamp, 10)) > (24 * 60 * 60 * 1000), // 24 hours
    };
  } catch (error) {
    return null;
  }
}

/**
 * Constant-time string comparison
 */
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch (error) {
    return false;
  }
}

/**
 * Generate cryptographically secure random number
 */
function secureRandom(min = 0, max = 1) {
  const range = max - min;
  if (range <= 0) {
    return min;
  }

  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValue = Math.pow(256, bytesNeeded);
  const threshold = maxValue - (maxValue % range);

  let randomValue;
  do {
    const randomBytes = crypto.randomBytes(bytesNeeded);
    randomValue = 0;
    for (let i = 0; i < bytesNeeded; i++) {
      randomValue = (randomValue << 8) + randomBytes[i];
    }
  } while (randomValue >= threshold);

  return min + (randomValue % range);
}

/**
 * Encrypt API key for storage
 */
function encryptApiKey(apiKey, masterKey) {
  if (!masterKey) {
    masterKey = process.env.MASTER_ENCRYPTION_KEY || 'default-key-change-in-production';
  }

  return encryptWithPassword(apiKey, masterKey);
}

/**
 * Decrypt API key from storage
 */
function decryptApiKey(encryptedApiKey, masterKey) {
  if (!masterKey) {
    masterKey = process.env.MASTER_ENCRYPTION_KEY || 'default-key-change-in-production';
  }

  return decryptWithPassword(encryptedApiKey, masterKey);
}

/**
 * Generate key pair for asymmetric encryption
 */
function generateKeyPair(type = 'rsa', options = {}) {
  const defaultOptions = {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  };

  const keyOptions = { ...defaultOptions, ...options };

  try {
    return crypto.generateKeyPairSync(type, keyOptions);
  } catch (error) {
    logger.error('Key pair generation failed', {
      error: error.message,
      type,
    });
    throw new Error('Key pair generation failed');
  }
}

/**
 * Sign data with private key
 */
function signData(data, privateKey, algorithm = 'sha256') {
  try {
    const sign = crypto.createSign(algorithm);
    sign.update(data);
    return sign.sign(privateKey, 'hex');
  } catch (error) {
    logger.error('Data signing failed', {
      error: error.message,
      algorithm,
    });
    throw new Error('Data signing failed');
  }
}

/**
 * Verify signature with public key
 */
function verifySignature(data, signature, publicKey, algorithm = 'sha256') {
  try {
    const verify = crypto.createVerify(algorithm);
    verify.update(data);
    return verify.verify(publicKey, signature, 'hex');
  } catch (error) {
    logger.error('Signature verification failed', {
      error: error.message,
      algorithm,
    });
    return false;
  }
}

module.exports = {
  generateKey,
  generateIV,
  generateSalt,
  deriveKey,
  encrypt,
  decrypt,
  encryptWithPassword,
  decryptWithPassword,
  hashString,
  hashWithSalt,
  generateHMAC,
  verifyHMAC,
  generateToken,
  generateUUID,
  generateApiKey,
  maskSensitiveData,
  validateApiKeyFormat,
  generateSessionToken,
  parseSessionToken,
  constantTimeEqual,
  secureRandom,
  encryptApiKey,
  decryptApiKey,
  generateKeyPair,
  signData,
  verifySignature,
};