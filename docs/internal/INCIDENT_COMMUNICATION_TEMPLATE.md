# Incident communication template (operator)

**Last updated:** 2026-04-07. **Use:** copy into email or status page; replace bracketed fields.

---

**Subject:** [AccessibleMadeFlexible] Service incident — [short summary]

**Audience:** [internal / affected customers / public]

**Status:** [investigating | identified | monitoring | resolved]

**What happened**  
[1–3 factual sentences. No speculation.]

**Customer impact**  
- [e.g. Private dashboards unavailable / scans queued / exports delayed]  
- [e.g. Public instant scan: unaffected]

**What we know**  
- Detection: [time TZ], via [monitoring / customer report / deploy].  
- Scope: [regions / tenants if known].  
- Root cause: [known | under investigation].

**What we are doing**  
- [Action 1]  
- [Action 2]

**Workarounds**  
- [If any — or explicitly “none”]

**Evidence / posture**  
- Deployment health: `https://[your-host]/api/health?detailed=true`  
- Operator system page (authenticated, `org:system:view`): `/system`

**Next update**  
[Time] or when [milestone].

**Contact**  
[PRODUCT_CONTACT_EMAIL or on-call]

---

**Resolved summary (when closing)**  
- Duration: [start–end]  
- Root cause: [final]  
- Preventive actions: [concrete]
