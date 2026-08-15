export interface ProfilePreferences {
  preferredKinds: string[];
  remoteOnly: boolean;
  minMatchScore: number;
  targetTitles?: string[];
  skills?: string[];
  minHourlyRate?: number;
  minAnnualComp?: number;
  workAuthorization?: string[];
  availability?: string;
}

export interface MatchCandidate {
  kind: string;
  location: string;
  matchScore: number;
}

export function passesEligibility(
  candidate: MatchCandidate,
  preferences: ProfilePreferences
): boolean {
  if (
    preferences.preferredKinds &&
    preferences.preferredKinds.length > 0 &&
    !preferences.preferredKinds.includes(candidate.kind)
  ) {
    return false;
  }
  if (
    preferences.remoteOnly &&
    !candidate.location.toLowerCase().includes("remote") &&
    !candidate.location.toLowerCase().includes("anywhere")
  ) {
    return false;
  }
  return candidate.matchScore >= preferences.minMatchScore;
}

export interface MatchEvaluation {
  score: number;
  confidence: "High" | "Medium" | "Review";
  reasons: string[];
}

export function evaluateOpportunityMatch(
  opportunity: {
    title: string;
    location: string;
    kind: string;
    compensation?: string;
    description?: string;
  },
  preferences: ProfilePreferences
): MatchEvaluation {
  const reasons: string[] = [];
  let score = 50; // Base score

  const titleLower = opportunity.title.toLowerCase();
  const descLower = (opportunity.description || "").toLowerCase();
  const fullText = `${titleLower} ${descLower}`;

  // 1. Target Title Alignment (+25 pts)
  const targetTitles = preferences.targetTitles ?? [];
  let titleMatched = false;
  for (const target of targetTitles) {
    const targetWords = target.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const matchCount = targetWords.filter((w) => titleLower.includes(w)).length;
    if (matchCount >= Math.min(2, targetWords.length)) {
      titleMatched = true;
      score += 25;
      reasons.push(`Title matches target role focus: "${target}"`);
      break;
    }
  }
  if (!titleMatched && targetTitles.length > 0) {
    const anyWord = targetTitles.some((t) =>
      t.toLowerCase().split(/\s+/).some((w) => w.length > 3 && titleLower.includes(w))
    );
    if (anyWord) {
      score += 15;
      reasons.push("Partial title keyword match");
    }
  }

  // 2. Skills & Tech Stack Alignment (+20 pts)
  const skills = preferences.skills ?? [];
  const matchedSkills: string[] = [];
  for (const skill of skills) {
    const skillLower = skill.toLowerCase();
    if (fullText.includes(skillLower)) {
      matchedSkills.push(skill);
    }
  }
  if (matchedSkills.length > 0) {
    const skillPoints = Math.min(20, matchedSkills.length * 6);
    score += skillPoints;
    reasons.push(`Verified skills in posting: ${matchedSkills.slice(0, 3).join(", ")}`);
  }

  // 3. Remote / Location Eligibility (+10 pts)
  const isRemote =
    opportunity.location.toLowerCase().includes("remote") ||
    opportunity.location.toLowerCase().includes("anywhere") ||
    opportunity.location.toLowerCase().includes("global");

  if (isRemote) {
    score += 10;
    reasons.push("Remote flexibility matches preference");
  } else if (!preferences.remoteOnly) {
    score += 5;
    reasons.push(`Location: ${opportunity.location}`);
  }

  // 4. Compensation / Rate Alignment (+10 pts)
  const comp = opportunity.compensation || "";
  if (comp && comp !== "Not disclosed" && comp !== "Disclosed in posting") {
    score += 8;
    reasons.push(`Compensation disclosed (${comp})`);
  }

  // 5. Opportunity Type Match (+5 pts)
  if (preferences.preferredKinds.includes(opportunity.kind)) {
    score += 5;
    reasons.push(`Matches preferred opportunity type (${opportunity.kind})`);
  }

  // Clamp score between 0 and 99
  const finalScore = Math.min(99, Math.max(30, score));

  // Determine confidence
  let confidence: "High" | "Medium" | "Review" = "Review";
  if (finalScore >= 80 && reasons.length >= 3) {
    confidence = "High";
  } else if (finalScore >= 65) {
    confidence = "Medium";
  }

  if (reasons.length === 0) {
    reasons.push("Eligible based on general persona preferences");
  }

  return {
    score: finalScore,
    confidence,
    reasons,
  };
}

export function scoreImportedOpportunity(
  title: string,
  location: string,
  preferences: ProfilePreferences
): number {
  return evaluateOpportunityMatch({ title, location, kind: "job" }, preferences).score;
}
