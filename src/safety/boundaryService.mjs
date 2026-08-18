const RED_PATTERNS = [
  /\bproperty\b/i,
  /\binheritance\b/i,
  /\binherit\b/i,
  /\bhouse\b/i,
  /\bland\b/i,
  /\bwill\b/i,
  /\bleave .* to me\b/i,

  /\btransfer money\b/i,
  /\bsend money\b/i,
  /\bwithdraw\b/i,
  /\bbank account\b/i,
  /\binvestment\b/i,
  /\bloan\b/i,
  /\bfinancial authority\b/i,

  /\bdiagnos(e|is)\b/i,
  /\bmedication\b/i,
  /\bdosage\b/i,
  /\bmedicine\b/i,
  /\bshould I take\b/i,
  /\bstop taking\b/i,

  /\blawsuit\b/i,
  /\blegal advice\b/i,
  /\blegally own\b/i,
  /\bsign .* contract\b/i,
  /\blegal rights\b/i,

  /\bpassword\b/i,
  /\botp\b/i,
  /\bapi key\b/i,
  /\bsecret\b/i,
  /\bsecurity answer\b/i,
];

const YELLOW_PATTERNS = [
  /\bcareer\b/i,
  /\bjob\b/i,
  /\beducation\b/i,
  /\bcollege\b/i,
  /\brelationship\b/i,
  /\bmarriage\b/i,
  /\bmove abroad\b/i,
  /\bmove overseas\b/i,
  /\bstart a business\b/i,
  /\bbusiness decision\b/i,
  /\bmajor decision\b/i,
];

export function checkBoundary(queryText) {
  if (!queryText || !queryText.trim()) {
    throw new Error("queryText is required.");
  }

  const query = queryText.trim();

  for (const pattern of RED_PATTERNS) {
    if (pattern.test(query)) {
      return {
        level: "RED",
        allowed: false,
        reason:
          "This request involves a restricted area where the Legacy Agent must not act as an authority.",
      };
    }
  }

  for (const pattern of YELLOW_PATTERNS) {
    if (pattern.test(query)) {
      return {
        level: "YELLOW",
        allowed: true,
        reason:
          "The Legacy Agent may discuss the person's recorded perspective, but must not make the decision for the user.",
      };
    }
  }

  return {
    level: "GREEN",
    allowed: true,
    reason:
      "Normal Legacy conversation is allowed.",
  };
}
