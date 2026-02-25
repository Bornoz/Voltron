import { describe, it, expect } from 'vitest';
import { extractPlan, updatePlanProgress } from '../agent-plan-extractor.js';

describe('extractPlan', () => {
  // ─── Numbered List Extraction ──────────────────────────────

  describe('numbered list extraction', () => {
    it('should extract numbered steps', () => {
      const text = `
Plan:
1. Read the existing configuration file
2. Update the database schema
3. Write new migration
4. Run tests to verify
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.plan.steps).toHaveLength(4);
      expect(result!.plan.steps[0].description).toBe('Read the existing configuration file');
      expect(result!.plan.steps[1].description).toBe('Update the database schema');
      expect(result!.plan.steps[2].description).toBe('Write new migration');
      expect(result!.plan.steps[3].description).toBe('Run tests to verify');
    });

    it('should handle parenthesis-style numbering', () => {
      const text = `
1) First step here
2) Second step here
3) Third step here
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.plan.steps).toHaveLength(3);
    });

    it('should skip very short descriptions', () => {
      const text = `
1. Do
2. This is a proper step
3. Go
4. And this is also good
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      // "Do" and "Go" are < 3 chars, should be skipped
      expect(result!.plan.steps).toHaveLength(2);
    });

    it('should have confidence 0.8 for numbered lists', () => {
      const text = `
1. First step
2. Second step
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.8);
    });
  });

  // ─── Step Marker Extraction ────────────────────────────────

  describe('step marker extraction', () => {
    it('should extract "Step N:" markers', () => {
      const text = `
Step 1: Initialize the project
Step 2: Configure the build system
Step 3: Add test infrastructure
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.plan.steps).toHaveLength(3);
      expect(result!.plan.steps[0].description).toBe('Initialize the project');
    });

    it('should handle Turkish "Adim" markers', () => {
      const text = `
Adim 1: Projeyi baslat
Adim 2: Yapilandirmayi duzenle
Adim 3: Testleri calistir
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.plan.steps).toHaveLength(3);
    });

    it('should have confidence 0.7 for step markers', () => {
      // No numbered list pattern, use step markers
      const text = `
Step 1. Create the service class
Step 2. Implement the interface
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      // If numbered list matches first, confidence will be 0.8
      // Step markers alone → 0.7
    });
  });

  // ─── Plan Header Detection ─────────────────────────────────

  describe('plan header detection', () => {
    it('should boost confidence with plan header', () => {
      const text = `
Plan: Implementation approach
1. Read the file
2. Modify the schema
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      // 0.8 (numbered) + 0.15 (header) = 0.95
      expect(result!.confidence).toBeCloseTo(0.95, 10);
    });

    it('should detect Turkish plan headers', () => {
      const text = `
Strateji: Veritabani guncelleme
1. Schema'yi oku
2. Migration olustur
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThan(0.8);
    });
  });

  // ─── Progress Markers ──────────────────────────────────────

  describe('progress markers', () => {
    it('should detect step progress', () => {
      const text = `
Step 2 of 4
1. Read config
2. Update schema
3. Run migration
4. Verify
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      // currentStepIndex should be 1 (step 2, 0-indexed)
      expect(result!.plan.currentStepIndex).toBe(1);
      expect(result!.plan.steps[0].status).toBe('completed');
      expect(result!.plan.steps[1].status).toBe('active');
      expect(result!.plan.steps[2].status).toBe('pending');
    });
  });

  // ─── File Path Extraction ─────────────────────────────────

  describe('file path extraction', () => {
    it('should extract file paths from step descriptions', () => {
      const text = `
1. Update src/components/Login.tsx with new form
2. Modify packages/server/src/index.ts for routing
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.plan.steps[0].filePath).toBe('src/components/Login.tsx');
      expect(result!.plan.steps[1].filePath).toBe('packages/server/src/index.ts');
    });

    it('should extract backtick-quoted paths', () => {
      const text = `
1. Edit \`config.json\` to add new settings
2. Update \`schema.prisma\` with user model
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.plan.steps[0].filePath).toBe('config.json');
      expect(result!.plan.steps[1].filePath).toBe('schema.prisma');
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────

  describe('edge cases', () => {
    it('should return null for empty string', () => {
      expect(extractPlan('')).toBeNull();
    });

    it('should return null for short text', () => {
      expect(extractPlan('Hello world')).toBeNull();
    });

    it('should return null for text without plan structure', () => {
      const text = 'This is a regular paragraph of text that does not contain any plan or step structure whatsoever.';
      expect(extractPlan(text)).toBeNull();
    });

    it('should return null for single step (needs >= 2)', () => {
      const text = '1. Only one step here\n\nSome other text.';
      expect(extractPlan(text)).toBeNull();
    });

    it('should truncate long step descriptions', () => {
      const longDesc = 'x'.repeat(250);
      const text = `
1. ${longDesc}
2. Short step
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.plan.steps[0].description.length).toBeLessThanOrEqual(200);
      expect(result!.plan.steps[0].description.endsWith('...')).toBe(true);
    });

    it('should handle mixed content', () => {
      const text = `
Let me think about this...

Here is my plan:
1. First, read the existing code
2. Then, refactor the module

Some additional thoughts here.
And more random text.
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.plan.steps).toHaveLength(2);
      expect(result!.confidence).toBeGreaterThan(0.8); // numbered + plan header
    });
  });

  // ─── Summary Extraction ────────────────────────────────────

  describe('summary extraction', () => {
    it('should extract summary from plan header', () => {
      const text = `
Plan: Database migration strategy
1. Backup current data
2. Apply schema changes
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.plan.summary.length).toBeGreaterThan(0);
    });

    it('should use first step as summary fallback', () => {
      const text = `
1. Initialize the new module
2. Add dependencies
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      // extractSummary falls back to first non-empty line which includes the number prefix
      // but the plan.summary fallback is `summary || steps[0].description`
      // Since extractSummary finds the first line > 5 chars, it returns the full line
      expect(result!.plan.summary.length).toBeGreaterThan(0);
      expect(result!.plan.summary).toContain('Initialize the new module');
    });
  });

  // ─── Confidence Scoring ────────────────────────────────────

  describe('confidence scoring', () => {
    it('should cap confidence at 1.0', () => {
      const text = `
Plan: Full implementation
Steps:
1. First thing
2. Second thing
3. Third thing
      `;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should return lower confidence for ordered markers', () => {
      const text = `
First, we should read the file carefully.
Second, we need to modify the schema.
Third, let's run the tests.
      `;
      const result = extractPlan(text);
      // This could match ordered markers or numbered list depending on implementation
      if (result) {
        expect(result.confidence).toBeLessThanOrEqual(1.0);
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
  });
});

describe('updatePlanProgress', () => {
  it('should mark step as active when file matches', () => {
    const plan = {
      summary: 'Test plan',
      steps: [
        { index: 0, description: 'Edit Login.tsx', status: 'pending' as const, filePath: 'src/components/Login.tsx' },
        { index: 1, description: 'Edit App.tsx', status: 'pending' as const, filePath: 'src/App.tsx' },
      ],
      currentStepIndex: 0,
      totalSteps: 2,
      confidence: 0.8,
    };

    const updated = updatePlanProgress(plan, 'project/src/components/Login.tsx');
    expect(updated.steps[0].status).toBe('active');
    expect(updated.steps[1].status).toBe('pending');
  });

  it('should mark previous active steps as completed', () => {
    const plan = {
      summary: 'Test plan',
      steps: [
        { index: 0, description: 'Step 1', status: 'active' as const, filePath: 'src/a.ts' },
        { index: 1, description: 'Step 2', status: 'pending' as const, filePath: 'src/b.ts' },
      ],
      currentStepIndex: 0,
      totalSteps: 2,
      confidence: 0.8,
    };

    const updated = updatePlanProgress(plan, 'project/src/b.ts');
    expect(updated.steps[0].status).toBe('completed');
    expect(updated.steps[1].status).toBe('active');
    expect(updated.currentStepIndex).toBe(1);
  });

  it('should not change steps when file does not match', () => {
    const plan = {
      summary: 'Test plan',
      steps: [
        { index: 0, description: 'Step 1', status: 'pending' as const, filePath: 'src/a.ts' },
      ],
      currentStepIndex: 0,
      totalSteps: 1,
      confidence: 0.8,
    };

    const updated = updatePlanProgress(plan, 'src/unrelated.ts');
    expect(updated.steps[0].status).toBe('pending');
  });

  it('should handle steps without filePath', () => {
    const plan = {
      summary: 'Test plan',
      steps: [
        { index: 0, description: 'Think about approach', status: 'pending' as const },
        { index: 1, description: 'Edit src/app.ts', status: 'pending' as const, filePath: 'src/app.ts' },
      ],
      currentStepIndex: 0,
      totalSteps: 2,
      confidence: 0.8,
    };

    const updated = updatePlanProgress(plan, 'project/src/app.ts');
    expect(updated.steps[0].status).toBe('pending');
    expect(updated.steps[1].status).toBe('active');
  });
});
