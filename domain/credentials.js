/** Fixed suffix is compatibility encoding, not encryption or extra password strength. */
export function loginCredentials(userId, password, options) {
  const id = String(userId).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,39}$/.test(id))
    throw new Error(
      "Use a valid user ID (letters, numbers, dot, hyphen or underscore).",
    );
  if (id !== options.userId.toLowerCase())
    throw new Error("User ID or password is incorrect.");
  if (!password) throw new Error("Enter your password.");
  const email = options.emailOverride || `${id}@${options.emailDomain}`;
  const encoded = password + options.passwordSuffix;
  if (encoded.length < 6)
    throw new Error(
      "The configured password encoding must produce at least six characters.",
    );
  return { email, password: encoded };
}
