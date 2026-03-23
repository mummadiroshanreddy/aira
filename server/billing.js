const { getUserStatus } = require('./db');

// ── SaaS Billing Middleware ───────────────────────────
// Enforces usage limits to protect the LLM proxy from abuse.

const FREE_TIER_TOKEN_LIMIT = 50000;

const checkBillingTier = (req, res, next) => {
  // Identify user by header or IP for local dev
  const userId = req.headers['x-user-id'] || 'anonymous';
  
  const status = getUserStatus(userId);

  if (status.tier === 'free' && status.tokensUsed > FREE_TIER_TOKEN_LIMIT) {
    return res.status(402).json({
      error: 'Free tier limit reached. Please upgrade to continue using ARIA.',
      code: 'PAYMENT_REQUIRED'
    });
  }

  next();
};

const stripeWebhookPlaceholder = (req, res) => {
    // Scaffold for Part 12: Stripe Integration
    // Example: verify signature, update user tier in DB, emit confirmation
    console.log('Stripe Webhook received:', req.body?.type);
    res.json({ received: true, status: 'acknowledged' });
};

module.exports = {
  checkBillingTier,
  stripeWebhookPlaceholder,
  FREE_TIER_TOKEN_LIMIT
};
