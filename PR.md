Title: 🔒 [security] Fix insecure random number generation for verification IDs

## Description
* 🎯 **What:** The verification and evidence IDs were being generated using `Math.random().toString(36)`, which is insecure and highly predictable. The fix replaces `Math.random()` with Node's built-in `crypto.randomBytes(8).toString('hex')`.
* ⚠️ **Risk:** Since `Math.random()` generates predictable output, attackers could potentially guess or bruteforce verification and evidence IDs. This could allow them to hijack verification sessions, forge evidence, or bypass critical security checks that rely on the unpredictability of these IDs.
* 🛡️ **Solution:** The fix replaces `Math.random()` with `randomBytes(8).toString('hex')` from the `crypto` library, which relies on a cryptographically secure pseudorandom number generator (CSPRNG), making the IDs unpredictable and secure against guessing attacks.
