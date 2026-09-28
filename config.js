// Public browser configuration. Never put passwords or service-account keys here.
export const config = {
  firebase: {
    apiKey: "AIzaSyD4vX-DeJ7ZqrNi4u9RgVYmuCtUTDSjIu4",
    authDomain: "tmj---accounts.firebaseapp.com",
    projectId: "tmj---accounts",
    appId: "1:490790729007:web:46458eba1d20704d369dda",
  },
  adminUid: "B1KzyiFd7Nh2cHNP2kDTG04rnUG3",
  login: {
    userId: "admin",
    emailDomain: "users.tmj-accounts.invalid",
    // Optional existing Firebase password-provider email for this user ID.
    emailOverride: "",
    passwordSuffix: "::TMJ-v1",
  },
  // Explicit local testing only. Never turn this on for the live site.
  demo: false,
  emulators: false,
};
