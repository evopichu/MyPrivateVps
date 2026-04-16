import express from 'express';
import passport from 'passport';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Google OAuth routes
router.get(
  '/google',
  (req, res, next) => {
    const redirectUrl = req.query.redirect as string || CORS_ORIGIN;
    // Store redirect URL in session for callback
    req.session.save(() => {
      (req.session as any)['oauth_redirect'] = redirectUrl;
    });
    
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      prompt: 'select_account'
    })(req, res, next);
  }
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `/api/auth/failure`,
    failureMessage: true
  }),
  (req: AuthRequest, res) => {
    try {
      logger.info(`User authenticated: ${req.user?.email}`);

      // Get the redirect URL from session or use default
      const redirectUrl = (req.session as any)['oauth_redirect'] || CORS_ORIGIN;
      delete (req.session as any)['oauth_redirect'];

      // Check if it's an Electron app (file:// protocol)
      if (redirectUrl.startsWith('file://')) {
        // Serve an HTML page that communicates with Electron
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Authentication Success</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: #202123;
                color: #fff;
              }
              .container {
                text-align: center;
              }
              .checkmark {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: #10a37f;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px;
              }
              h2 { margin: 0 0 10px; }
              p { color: #8e8ea0; margin: 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="checkmark">✓</div>
              <h2>Authentication Successful</h2>
              <p>You can close this window and return to the app.</p>
            </div>
            <script>
              // Send message to parent window if in Electron
              if (window.opener) {
                window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '*');
              }
              // Try to close the window after a delay
              setTimeout(() => {
                window.close();
              }, 2000);
            </script>
          </body>
          </html>
        `);
      } else {
        // Redirect with success indicator for web
        res.redirect(`${redirectUrl}?auth=success`);
      }
    } catch (error) {
      logger.error('OAuth callback error:', error);
      res.redirect(`${CORS_ORIGIN}?auth=failure&error=${encodeURIComponent('Callback error')}`);
    }
  }
);

// OAuth failure handler
router.get('/failure', (req, res) => {
  const message = (req.session as any)?.messages?.error || 'Authentication failed';
  const redirectUrl = (req.session as any)?.oauth_redirect || CORS_ORIGIN;
  logger.error('Google OAuth failure:', message);

  // Check if it's an Electron app (file:// protocol)
  if (redirectUrl.startsWith('file://')) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #202123;
            color: #fff;
          }
          .container { text-align: center; }
          .xmark {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: #ef4444;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 24px;
          }
          h2 { margin: 0 0 10px; }
          p { color: #8e8ea0; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="xmark">✕</div>
          <h2>Authentication Failed</h2>
          <p>${message}</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'AUTH_FAILURE', error: '${message}' }, '*');
          }
          setTimeout(() => { window.close(); }, 3000);
        </script>
      </body>
      </html>
    `);
  } else {
    res.redirect(`${CORS_ORIGIN}?auth=failure&error=${encodeURIComponent(message)}`);
  }
});

// Get current user
router.get('/me', authenticate, (req: AuthRequest, res) => {
  try {
    const user = req.user;
    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      provider: user.provider,
      isVerified: user.isVerified,
      permissions: user.permissions,
      preferences: Object.fromEntries(user.preferences),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// CLI OAuth code exchange - returns JSON with token
router.post('/google/exchange', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'No authorization code provided' });
    }

    // Exchange code for tokens using Google API
    const axios = require('axios');
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'http://localhost:8765/auth/callback',
      grant_type: 'authorization_code'
    });

    const { access_token, id_token } = tokenResponse.data;

    // Get user info from Google
    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const googleUser = userResponse.data;
    const User = require('../models/User').User;

    // Find or create user
    let user = await User.findOne({ email: googleUser.email });
    if (!user) {
      user = await User.create({
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        provider: 'google',
        isVerified: googleUser.verified_email,
        isActive: true,
        role: 'user',
      });
      logger.info(`New user created via CLI OAuth: ${googleUser.email}`);
    } else {
      // Update last login
      user.lastLoginAt = new Date();
      await user.save();
    }

    // Generate JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    logger.info(`CLI OAuth success: ${user.email}`);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        provider: user.provider,
      }
    });
  } catch (error: any) {
    logger.error('CLI OAuth exchange error:', error.response?.data || error.message);
    res.status(500).json({ error: 'OAuth code exchange failed' });
  }
});

// Register endpoint for email/password
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const User = require('../models/User').User;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      provider: 'local',
      isVerified: true,
      isActive: true,
      role: 'user',
    });

    // Generate JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        provider: user.provider,
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Email/password login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const User = require('../models/User').User;

    // Find user
    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const bcrypt = require('bcryptjs');
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        provider: user.provider,
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      logger.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

export default router;
