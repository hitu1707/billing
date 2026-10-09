import 'dotenv/config';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as DiscordStrategy } from 'passport-discord';
import User from '../models/User.js';
import { comparePassword } from '../utils/password.js';
import logger from './logger.js';

passport.serializeUser((user, done) => {
  const id = user._id || user.id;
  done(null, id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-password');
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user || !user.password) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
      } catch (error) {
        logger.error(`Passport Local Error: ${error.message}`);
        return done(error);
      }
    }
  )
);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_google_id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_google_secret',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
      // Binds the authorization request to the session to prevent OAuth CSRF.
      state: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Only trust/link an email Google has actually verified.
        const emailVerified = (profile._json || {}).email_verified !== false;
        const email = emailVerified ? profile.emails?.[0]?.value?.toLowerCase() : undefined;
        const avatar = profile.photos?.[0]?.value;

        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        if (email) {
          user = await User.findOne({ email });
          if (user) {
            user.googleId = profile.id;
            if (!user.avatar) user.avatar = avatar;
            await user.save();
            return done(null, user);
          }
        }

        user = await User.create({
          name: profile.displayName || 'Google User',
          email: email || `${profile.id}@google.oauth`,
          googleId: profile.id,
          avatar: avatar || null,
          authProvider: 'google'
        });

        return done(null, user);
      } catch (error) {
        logger.error(`Google OAuth Error: ${error.message}`);
        return done(error, null);
      }
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID || 'dummy_facebook_id',
      clientSecret: process.env.FACEBOOK_APP_SECRET || 'dummy_facebook_secret',
      callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3000/api/auth/facebook/callback',
      profileFields: ['id', 'displayName', 'emails', 'photos'],
      // Binds the authorization request to the session to prevent OAuth CSRF.
      state: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        const avatar = profile.photos?.[0]?.value;

        let user = await User.findOne({ facebookId: profile.id });
        if (user) return done(null, user);

        if (email) {
          user = await User.findOne({ email });
          if (user) {
            // This flow has no OTP step, so never silently merge it into an
            // account created another way (that would bypass the account's 2FA).
            if (user.authProvider !== 'facebook') {
              return done(null, false, {
                message: 'Email already registered. Please sign in with your original method.'
              });
            }
            user.facebookId = profile.id;
            if (!user.avatar) user.avatar = avatar;
            await user.save();
            return done(null, user);
          }
        }

        user = await User.create({
          name: profile.displayName || 'Facebook User',
          email: email || `${profile.id}@facebook.oauth`,
          facebookId: profile.id,
          avatar: avatar || null,
          authProvider: 'facebook'
        });

        return done(null, user);
      } catch (error) {
        logger.error(`Facebook OAuth Error: ${error.message}`);
        return done(error, null);
      }
    }
  )
);

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID || 'dummy_discord_id',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || 'dummy_discord_secret',
      callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/api/auth/discord/callback',
      scope: ['identify', 'email'],
      // Binds the authorization request to the session to prevent OAuth CSRF.
      state: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.email?.toLowerCase();
        const avatar = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : null;

        let user = await User.findOne({ discordId: profile.id });
        if (user) return done(null, user);

        if (email) {
          user = await User.findOne({ email });
          if (user) {
            // This flow has no OTP step, so never silently merge it into an
            // account created another way (that would bypass the account's 2FA).
            if (user.authProvider !== 'discord') {
              return done(null, false, {
                message: 'Email already registered. Please sign in with your original method.'
              });
            }
            user.discordId = profile.id;
            if (!user.avatar) user.avatar = avatar;
            await user.save();
            return done(null, user);
          }
        }

        user = await User.create({
          name: profile.username || 'Discord User',
          email: email || `${profile.id}@discord.oauth`,
          discordId: profile.id,
          avatar: avatar || null,
          authProvider: 'discord'
        });

        return done(null, user);
      } catch (error) {
        logger.error(`Discord OAuth Error: ${error.message}`);
        return done(error, null);
      }
    }
  )
);

export default passport;
