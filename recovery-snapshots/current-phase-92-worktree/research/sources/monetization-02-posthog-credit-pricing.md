Source: https://posthog.com/docs/posthog-ai/pricing
Title: PostHog AI pricing - Docs - PostHog
Fetched: 2026-11-07T15:13:15.741Z

Products [Pricing](https://posthog.com/pricing) DocsCommunityCompanyMore

![](https://res.cloudinary.com/dmukukwp6/image/upload/w_1780,q_auto,f_auto/9000_hogzilla_359a450fb3.png)

![](https://res.cloudinary.com/dmukukwp6/image/upload/w_2967,q_auto,f_auto/9000_monopoly_light_6614a8a5d5.jpg)

![](https://res.cloudinary.com/dmukukwp6/image/upload/w_1582,q_auto,f_auto/9000_monopoly_dark_26c85ccad8.jpg)

![](https://res.cloudinary.com/dmukukwp6/image/upload/w_997,q_auto,f_auto/office_cc4ae8675f.png)

![](https://res.cloudinary.com/dmukukwp6/image/upload/w_800,q_auto,f_auto/9000_hedge_light_42c729131e.png)

![](https://res.cloudinary.com/dmukukwp6/image/upload/w_800,q_auto,f_auto/9000_hedge_dark_b36706e924.png)

Copy page

# PostHog AI pricing

#### Contents

- What consumes AI credits
- What doesn't consume AI credits
- How AI credit usage works
- Track your AI credit usage
- Control your AI credit spend

AI features in PostHog consume **AI credits**. Each time you interact with an AI-powered feature – whether you're asking PostHog AI to write SQL, summarize data, or analyze sessions – credits are spent based on the resources required to complete your request.

This means you pay for what you use. There’s no fixed subscription and every organization gets a monthly free tier worth $5 (500 AI credits) to explore PostHog AI's features.

For reference, **100 AI credits = $1**.

We apply a simple, consistent 20% markup over the underlying LLM provider’s cost. So 1 PostHog AI credit corresponds to $0.008333 of raw inference.

500

credits/month

$0

5003k10k50k100k

#### Allocation

#### Price

#### Your selection

#### Subtotal

##### First 500 credits

##### **$0.00**/credit

500

$0

##### 500+

##### **$0.01**/credit

0

$0

## What consumes AI credits

AI credits are consumed whenever PostHog performs intelligent work for you. You’ll spot these features by the  icon or when using the in-app chat.

Examples include:

- Searching for session recordings in natural language
- Summarizing experiment results
- Writing or debugging SQL with AI
- [Summarizing survey responses](https://posthog.com/docs/surveys/summarize-responses-ai)
- AI summaries in [insight and dashboard subscriptions](https://posthog.com/docs/product-analytics/subscriptions#ai-summaries)
- [Prompt subscriptions](https://posthog.com/docs/product-analytics/subscriptions#prompt-subscriptions)

## What doesn't consume AI credits

Getting help on how to use PostHog (i.e., asking questions about our docs) does not use AI credits.

AI features in beta are also free to use.

## How AI credit usage works

AI credits are based on the **underlying token costs**, which reflect the effort required to complete your request.

- Simple queries like "What were my daily active users in October?" use very few tokens, and therefore very few credits.
- More complex tasks like analyzing hundreds of session recordings or rewriting a SQL query multiple times use more tokens and consume more credits.
- PostHog automatically selects the most efficient model for each AI feature.

While exact usage varies, credit consumption usually scales with complexity – more advanced tasks cost more but can deliver deeper insights and time savings. You’ll always see **real-time cost information** while using AI features.

## Track your AI credit usage

Stay on top of your AI credit spend in real time:

1. Type [`/usage`](https://app.posthog.com/#panel=max:!/usage) in chat to see the current cost of your conversation
2. Check the [billing overview](https://app.posthog.com/organization/billing/overview) and [billing usage](https://app.posthog.com/organization/billing/usage) pages to view your total monthly consumption
3. (Coming soon) A dashboard showing which AI features use the most credits

![/usage command in chat](https://res.cloudinary.com/dmukukwp6/image/upload/q_auto,f_auto/SCR_20251202_rado_2_81783b4e80.png)![/usage command in chat](https://res.cloudinary.com/dmukukwp6/image/upload/q_auto,f_auto/SCR_20251202_raiy_029e63db10.png)

The /usage command in chat shows your current AI credit usage

**Important**

Credit data may take up to 24 hours to appear on the billing overview and billing usage pages.

## Control your AI credit spend

You’re always in control of your AI credit usage:

- **Real-time tracking:** See costs as you go
- **Custom billing limit:** Set hard caps to prevent overspending
- **Default billing limit:** PostHog sets a default $150 billing limit so you don't accidentally rack up costs without a ceiling
- **Usage alerts:** Get notified when you hit key thresholds

When you hit your credit limit, AI features pause until your credits reset at the next billing period. For subscriptions:

- **[Prompt subscriptions](https://posthog.com/docs/product-analytics/subscriptions#prompt-subscriptions)** are paused entirely and automatically resume when credits are available.
- **[Insight and dashboard subscriptions with AI summaries](https://posthog.com/docs/product-analytics/subscriptions#when-ai-credits-run-out)** continue to deliver on schedule, but without the AI-generated summary.

### Still have questions?

Ask PostHog AI

### Was this page useful?

HelpfulCould be better