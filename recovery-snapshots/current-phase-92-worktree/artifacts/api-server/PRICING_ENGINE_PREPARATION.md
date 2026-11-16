# Pricing engine status

The API includes a deterministic internal cost calculator for future measured
task pricing. It is not connected to customer-facing interpretation quotes.

## Current customer price

Paid interpretations use a fixed, owner-approved server configuration:
35 ZionCore Credits per completed interpretation. The quote endpoint reports
that price and the signed-in user's available wallet balance before a request.
The server reserves credits before generation, settles only after a valid
report, and releases the reservation if the job fails.

Credit packs and the monthly Premium membership are loaded from the active
Stripe catalog. Pack purchases and subscriptions are separate from the
interpretation quote; Premium currently does not include credits.

## Internal calculator boundary

The deterministic calculator remains a separate preparation tool. Its output
is not used to vary a customer's charge, and the current 35-credit price is not
a per-job estimate of model or infrastructure cost. Do not connect the
calculator to Checkout until trusted cost measurements, margin policy, quote
expiry, customer approval, reservation, settlement, refunds, and duplicate
event handling have been reviewed and tested.

Cost inputs and policy values must be constructed by trusted server code, not
accepted from a browser. Internal cost and margin values should not be returned
to customers unless the product explicitly intends to disclose them.
