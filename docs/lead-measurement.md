# Website lead measurement

The homepage records phone_call, sms_click, get_quote_click, and quote_form_submit. Quote submissions now include a unique WEB reference, submission-page path, and utm_source, utm_medium, and utm_campaign when present in that page's URL. Personal contact fields are sent only with the quote, not added to analytics events.

To measure bookings, keep a record of each inquiry reference, contact channel, campaign, booked/not booked status, and job revenue. Use the WEB reference from the quote email to match the booked job. Call/text clicks measure intent, not completed calls or booked jobs; those outcomes must be recorded from actual conversations.

Pending account verification: confirm these events in GA4 DebugView/Realtime, designate successful quote submissions as a key event, and compare submissions to received inquiries. The browser test intercepts Formspree responses and verifies success/failure behavior; it does not establish real email delivery or live analytics receipt.

Current campaign fields describe the submission URL; cross-page and returning-visitor attribution require further analytics/CRM configuration. No CRM integration is configured in this static site.
