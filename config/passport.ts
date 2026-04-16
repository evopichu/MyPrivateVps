import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export function initializePassport(app: express.Express): void {
  // Session configuration
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    logger.warn('SESSION_SECRET not set, using default (not recommended for production)');
  }

  const mongoUrl = process.env.MONGODB_URI;
  if (!mongoUrl) {
    logger.warn('MONGODB_URI not set, sessions will be stored in memory (not recommended for production)');
  }

  const isProduction = process.env.NODE_ENV === 'production';

  const sessionConfig: session.SessionOptions = {
    secret: sessionSecret || 'default-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Must be false for Electron and OAuth redirects
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax', // 'lax' allows OAuth redirects
    },
    name: 'flowforge.sid',
    proxy: true,
  };

  // Only use MongoStore if MongoDB is configured
  if (mongoUrl) {
    try {
      sessionConfig.store = MongoStore.create({
        mongoUrl,
        collectionName: 'sessions',
        touchAfter: 24 * 3600, // Update session every 24 hours
      });
    } catch (error) {
      logger.warn('Failed to initialize MongoStore, using memory store:', error);
    }
  }

  app.use(session(sessionConfig));
  app.use(passport.initialize());
  app.use(passport.session());

  // Trust proxy for OAuth behind reverse proxy
  app.set('trust proxy', true);

  // Google OAuth Strategy
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`;

  if (googleClientId && googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: googleCallbackUrl,
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            const { User } = await import('../models/User');
            
            const googleId = profile.id;
            const email = profile.emails?.[0]?.value;
            const name = profile.displayName || email?.split('@')[0] || 'User';

            if (!email) {
              return done(new Error('Email is required from Google profile'));
            }

            let user = await User.findOne({ $or: [{ googleId }, { email }] });

            if (user) {
              // Update existing user
              if (googleId && !user.googleId) {
                user.googleId = googleId;
              }
              if (name && user.name !== name) {
                user.name = name;
              }
              user.lastLoginAt = new Date();
              await user.save();
              logger.info(`User logged in: ${email}`);
            } else {
              // Create new user
              user = await User.create({
                googleId,
                email,
                name,
                provider: 'google',
                isVerified: true,
                permissions: ['user'],
                preferences: {},
                createdAt: new Date(),
                lastLoginAt: new Date(),
              });
              logger.info(`New user created: ${email}`);
            }

            return done(null, user);
          } catch (error) {
            logger.error('Google OAuth error:', error);
            return done(error);
          }
        }
      )
    );
    logger.info('Google OAuth strategy configured');
  } else {
    logger.warn('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
  }

  // Serialize/deserialize user
  passport.serializeUser((user: any, done) => {
    done(null, user._id.toString());
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const { User } = await import('../models/User');
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      logger.error('Deserialize user error:', error);
      done(error);
    }
  });
}
