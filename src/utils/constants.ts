export const AUTH_COOKIE_NAME = "pilotshala_auth_token";

export const cookieOptions = {
  maxAge: 1000 * 60 * 60 * 24 * 15, // 15 days
  httpOnly: true,
  secure: true,
  sameSite: "none" as "none" | "lax",
};

// Navigation sub-subjects that should be grouped under "Navigation"
export const NAVIGATION_SUBJECTS = ["Instruments", "Performance", "Radio Navigation"];

// Main subjects for exams
export const MAIN_SUBJECTS = ["Meteorology", "Regulations", "Navigation", "Technical", "Technical Specific"];

/**
 * Groups navigation sub-subjects under "Navigation"
 * @param subjects - Array of subjects from database
 * @returns Array of main subjects with navigation sub-subjects grouped
 */
export const groupSubjectsForDisplay = (subjects: string[]): string[] => {
  const mainSubjects = subjects.filter(subject => !NAVIGATION_SUBJECTS.includes(subject));
  
  // Add "Navigation" if any navigation sub-subjects exist
  if (subjects.some(subject => NAVIGATION_SUBJECTS.includes(subject))) {
    if (!mainSubjects.includes("Navigation")) {
      mainSubjects.push("Navigation");
    }
  }
  
  return mainSubjects.sort((a, b) => {
    const indexA = MAIN_SUBJECTS.indexOf(a);
    const indexB = MAIN_SUBJECTS.indexOf(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
};

/**
 * Gets the main subject for exam creation
 * @param subject - The subject name (could be main or sub-subject)
 * @returns The main subject name
 */
export const getMainSubject = (subject: string): string => {
  if (NAVIGATION_SUBJECTS.includes(subject)) {
    return "Navigation";
  }
  return subject;
};

/**
 * Gets all sub-subjects for a main subject
 * @param mainSubject - The main subject name
 * @returns Array of sub-subjects or empty array if no sub-subjects
 */
export const getSubSubjects = (mainSubject: string): string[] => {
  if (mainSubject === "Navigation") {
    return NAVIGATION_SUBJECTS;
  }
  return [];
};
