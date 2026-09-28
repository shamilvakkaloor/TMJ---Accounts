/** Fixed suffix is compatibility encoding, not encryption or extra password strength. */
export function loginCredentials(userId, password, options) {
  const id = String(userId).trim().toLowerCase();
  const configuredId = options.userId.trim().toLowerCase();
  const email = (options.emailOverride || `${configuredId}@${options.emailDomain}`).trim().toLowerCase();
  if (id !== configuredId && id !== email)
    throw new Error("Administrator user ID, email or password is incorrect.");
  if (!password) throw new Error("Enter your password.");
  const encoded = password + options.passwordSuffix;
  if (encoded.length < 6)
    throw new Error(
      "The configured password encoding must produce at least six characters.",
    );
  return { email, password: encoded };
}
