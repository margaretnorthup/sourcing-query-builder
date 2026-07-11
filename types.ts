/** A single runnable query, either a Google X-ray or a LinkedIn Boolean string. */
export type SourcingQuery = {
  platform: string;
  query: string;
  note: string;
};

export type RubricRow = {
  criterion: string;
  lookFor: string;
};

/** The JSON contract the model is held to. Mirrored as a JSON Schema in app/api/sourcing/route.ts. */
export type SourcingKit = {
  role: string;
  xrayQueries: SourcingQuery[];
  booleanStrings: SourcingQuery[];
  idealProfile: {
    seniorSignals: string[];
    midVsSenior: string;
    adjacentCompanies: string[];
    technicalMarkers: string[];
  };
  screening: {
    rubric: RubricRow[];
    calibrationQuestions: string[];
  };
};

export type SourcingRequest = {
  brief: string;
  platforms: string[];
};

export type SourcingErrorResponse = {
  error: string;
};

export type SourcingResponse = SourcingKit | SourcingErrorResponse;
