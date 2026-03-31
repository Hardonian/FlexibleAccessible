import type { PrismaClient, RecipeReviewLevel } from '@aros/db';

type RecipeSeed = {
  ruleId: string;
  defectClass: string;
  title: string;
  applicableTargets: string[];
  frameworks: string[];
  strategy: string;
  guidance: string;
  verificationSteps: string[];
  riskNotes: string[];
  requiredReviewLevel: RecipeReviewLevel;
  confidence: number;
};

const DEFAULT_RECIPES: Record<string, RecipeSeed> = {
  'image-alt': {
    ruleId: 'image-alt',
    defectClass: 'missing_alt_text',
    title: 'Add accurate alternative text',
    applicableTargets: ['IMG', 'PICTURE', 'SVG'],
    frameworks: ['html', 'react', 'nextjs'],
    strategy:
      'Prefer authoring descriptive alt text based on the image purpose; use empty alt only for genuinely decorative imagery.',
    guidance:
      'Avoid filename-based placeholders in production. If the image is interactive or conveys state, keep the visible context and surrounding label copy aligned with the alt text.',
    verificationSteps: [
      'Confirm the image has an alt attribute with purposeful text.',
      'Verify the alt matches the user-visible function or meaning of the image.',
      'Re-run automated scan and confirm no image-alt finding remains.',
    ],
    riskNotes: [
      'Decorative images should use empty alt rather than redundant descriptions.',
      'Brand logos often need a consistent canonical description across the product.',
    ],
    requiredReviewLevel: 'MEDIUM',
    confidence: 0.9,
  },
  'button-name': {
    ruleId: 'button-name',
    defectClass: 'missing_button_name',
    title: 'Provide a durable button name',
    applicableTargets: ['BUTTON', '[role=button]'],
    frameworks: ['html', 'react', 'nextjs'],
    strategy:
      'Prefer visible button text. Use aria-label only when a compact icon-only control is genuinely required.',
    guidance:
      'Make sure icon-only buttons expose an accurate accessible name and that decorative icons are hidden from assistive tech when appropriate.',
    verificationSteps: [
      'Verify the button exposes a non-empty accessible name.',
      'Keyboard tab to the control and confirm its spoken label is accurate.',
      'Re-run automated scan and confirm no button-name finding remains.',
    ],
    riskNotes: [
      'aria-label strings drift easily when the product copy changes.',
      'Avoid duplicating visible text and aria-label with conflicting values.',
    ],
    requiredReviewLevel: 'MEDIUM',
    confidence: 0.88,
  },
  'label': {
    ruleId: 'label',
    defectClass: 'missing_form_label',
    title: 'Associate controls with visible labels',
    applicableTargets: ['INPUT', 'SELECT', 'TEXTAREA'],
    frameworks: ['html', 'react', 'nextjs'],
    strategy:
      'Use native label associations first, then supplement with helper text, descriptions, and errors bound programmatically.',
    guidance:
      'Do not rely on placeholders as the primary label. Keep for/id or aria-labelledby relationships stable across renders.',
    verificationSteps: [
      'Verify the control has a programmatic label.',
      'Check focus, error, and helper text associations where present.',
      'Re-run automated scan and confirm no label finding remains.',
    ],
    riskNotes: [
      'Generated ids can break label associations when hydrated differently on client and server.',
    ],
    requiredReviewLevel: 'HIGH',
    confidence: 0.92,
  },
  'link-name': {
    ruleId: 'link-name',
    defectClass: 'missing_link_name',
    title: 'Give the link a discernible destination',
    applicableTargets: ['A', '[role=link]'],
    frameworks: ['html', 'react', 'nextjs'],
    strategy:
      'Use visible, descriptive link text that explains destination or action. For icon links, ensure the accessible name reflects the destination.',
    guidance:
      'Avoid generic labels like "click here". Social and utility icons should expose the brand or action name.',
    verificationSteps: [
      'Verify the link exposes a non-empty accessible name.',
      'Confirm the label differentiates the destination from nearby links.',
      'Re-run automated scan and confirm no link-name finding remains.',
    ],
    riskNotes: ['Ambiguous link text often survives scanner fixes but still fails manual review.'],
    requiredReviewLevel: 'MEDIUM',
    confidence: 0.86,
  },
};

export function getDefaultRemediationRecipe(ruleId: string): RecipeSeed | null {
  return DEFAULT_RECIPES[ruleId] ?? null;
}

export async function resolveRemediationRecipe(
  prisma: PrismaClient,
  input: { organizationId?: string | null; ruleId: string }
) {
  const seed =
    getDefaultRemediationRecipe(input.ruleId) ??
    ({
      ruleId: input.ruleId,
      defectClass: input.ruleId,
      title: `Remediate ${input.ruleId}`,
      applicableTargets: [],
      frameworks: ['html'],
      strategy: 'Review the failing pattern, prefer semantic HTML, and avoid unguided ARIA-only patches.',
      guidance:
        'This recipe was created from fallback rule knowledge because a dedicated rule-specific recipe is not defined yet.',
      verificationSteps: ['Re-run automated verification for the affected pages and confirm the finding no longer appears.'],
      riskNotes: ['Fallback recipe: needs human review before large-scale reuse.'],
      requiredReviewLevel: 'HIGH' as const,
      confidence: 0.4,
    } satisfies RecipeSeed);

  const existing = await prisma.remediationRecipe.findFirst({
    where: {
      organizationId: input.organizationId ?? null,
      ruleId: seed.ruleId,
      defectClass: seed.defectClass,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.remediationRecipe.update({
      where: { id: existing.id },
      data: {
        title: seed.title,
        applicableTargets: seed.applicableTargets,
        frameworks: seed.frameworks,
        strategy: seed.strategy,
        guidance: seed.guidance,
        verificationSteps: seed.verificationSteps,
        riskNotes: seed.riskNotes,
        requiredReviewLevel: seed.requiredReviewLevel,
        confidence: seed.confidence,
      },
    });
  }

  return prisma.remediationRecipe.create({
    data: {
      organizationId: input.organizationId ?? null,
      ruleId: seed.ruleId,
      defectClass: seed.defectClass,
      title: seed.title,
      applicableTargets: seed.applicableTargets,
      frameworks: seed.frameworks,
      strategy: seed.strategy,
      guidance: seed.guidance,
      verificationSteps: seed.verificationSteps,
      riskNotes: seed.riskNotes,
      requiredReviewLevel: seed.requiredReviewLevel,
      confidence: seed.confidence,
    },
  });
}
