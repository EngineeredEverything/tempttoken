# TEMPT Token ($TMPT) - MVP Documentation

## Overview
A utility-driven cryptocurrency token built on Solana with governance, tiered access, and sustainable tokenomics.

## Live Demo
- **Landing Page:** `index.html`
- **Holder Dashboard:** `dashboard.html`
- **Governance Portal:** `governance.html`

## Features

### 1. Landing Page (`index.html`)
- Hero section with clear value proposition
- Utility modules showcase (Access, Discounts, Governance)
- Tokenomics display
- 3-quarter roadmap (Q1-Q3)
- Community links (Discord, Telegram, Twitter)
- Responsive design with smooth scroll navigation

### 2. Holder Dashboard (`dashboard.html`)
- **Wallet Connection:** Demo mode with simulated Solana wallet
- **Portfolio Display:** Token balance, USD value, voting power
- **Access Tiers:**
  - 🥉 Basic: 0-999 $TMPT
  - 🥈 Silver: 1,000-9,999 $TMPT
  - 🥇 Gold: 10,000+ $TMPT
- **Activity Feed:** Recent transactions and interactions

### 3. Governance Portal (`governance.html`)
- **Active Proposals:** Real-time voting interface
- **Voting System:** For/Against with live vote counts
- **Proposal Creation:** Form for submitting new governance proposals
- **Completed Proposals:** Historical record with outcomes

## Tech Stack
- **Frontend:** HTML5, Tailwind CSS (CDN), Vanilla JavaScript
- **Design:** Space Grotesk font, purple/pink gradient theme
- **Deployment:** Static files (no backend required for demo)

## Design Principles
1. **Dark Mode First:** Modern aesthetic with bg-gray-950
2. **Gradient Accents:** Purple (#667eea) to violet (#764ba2)
3. **Responsive:** Mobile-first design with Tailwind breakpoints
4. **Accessibility:** Semantic HTML, clear contrast ratios

## Demo Mode Notes
- Wallet connection is simulated (no real blockchain integration yet)
- Token balances and voting are randomly generated for demo
- All data is client-side only (resets on refresh)

## Next Steps for Production

### Phase 1: Smart Contract (Solana)
- [ ] Deploy SPL token contract on Solana testnet
- [ ] Implement real wallet connection (Phantom, Solflare)
- [ ] Add token mint/transfer functionality
- [ ] Set up multisig treasury wallet

### Phase 2: Backend Infrastructure
- [ ] API for real-time token data
- [ ] Database for governance proposals
- [ ] User authentication via wallet signature
- [ ] Activity tracking and analytics

### Phase 3: Advanced Features
- [ ] Staking mechanism (90-day lock, 5% APY)
- [ ] Premium content access gates
- [ ] Discord/Telegram bot integration
- [ ] Mobile app (React Native)

### Phase 4: Launch
- [ ] Security audit (Certik/Hacken)
- [ ] DEX listing (Raydium, Orca)
- [ ] Marketing campaign
- [ ] Community airdrop

## File Structure
```
/var/www/dashboard/apps/tempttoken/
├── index.html          # Landing page
├── dashboard.html      # Holder dashboard
├── governance.html     # Voting portal
└── README.md          # This file
```

## Budget
- **Approved:** $700 for MVP
- **Allocation:**
  - Smart contract dev: $300
  - Security audit: $200
  - Initial liquidity: $150
  - Marketing assets: $50

## Revenue Model
- **Transaction Fees:** 3-5% on token swaps
- **Premium Tiers:** Monthly subscriptions for Gold tier perks
- **Governance Fees:** Small fee to submit proposals (spam prevention)
- **Projected Revenue:** $500K-$2M annually (at 10K-50K holders)

## Contact
- **Owner:** Clay Fulk (@clayfulk)
- **Telegram:** 8455365258

## License
Proprietary - All rights reserved

---

**Status:** MVP Complete ✅ (2026-02-08)
