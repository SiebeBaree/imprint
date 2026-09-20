import type { BrandProfile, CampaignPlan } from "@repo/contracts";

const evidence = (detail: string) => [{ sourceId: "a5555555-5555-4555-8555-555555555555", detail }];
const field = (value: string, detail: string) => ({ value, evidence: evidence(detail), confirmed: false });
export const testProfile: BrandProfile = {
    positioning: field(
        "The distinctive caramelized biscuit, enjoyed as a biscuit or a smooth spread. Show familiar products in everyday food moments.",
        "Positioning from the test guidelines.",
    ),
    audience: field(
        "People who already enjoy Biscoff biscuits and want a simple way to bring that flavor to breakfast, baking or dessert.",
        "The example references focus on approachable food occasions.",
    ),
    voice: field(
        "Warm, simple and a little playful. Lead with the food and a concrete occasion. Keep captions short. Avoid exaggerated promises and generic lifestyle slogans.",
        "Example captions use familiar food language.",
    ),
    photography: field(
        "Natural window light, warm neutrals and appetizing close-ups. Use real crumbs, uneven spreads and everyday tableware. Keep the red lid and label clear. A person can be present, but the product and food should lead the scene.",
        "The sample breakfast images use warm directional light and natural textures.",
    ),
    colors: [
        { name: "Biscoff red", hex: "#D7272E", evidence: evidence("Red product label and lid.") },
        { name: "Cream", hex: "#F4EBDD", evidence: evidence("Warm backgrounds in the example references.") },
        { name: "Caramel", hex: "#AC6A35", evidence: evidence("The biscuit and spread color.") },
    ],
    fonts: field(
        "Use a clean sans serif for campaign headlines. Keep the original product label typography intact. The campaign font has not been verified from an official guideline.",
        "The test guidelines do not specify a font.",
    ),
    productRules: field(
        "Preserve the Lotus Biscoff name, red lid, glass jar proportions and label layout. Keep the spread smooth and caramel brown. Do not change the product variant, replace the package or invent label text.",
        "Visible package details in the product references.",
    ),
    approvedClaims: [],
    avoid: [
        "Invented nutritional, health or sustainability claims",
        "Distorted jars, misspelled labels or altered logos",
        "Overly glossy food and artificial-looking skin",
    ],
    questions: ["Confirm the font you want to use in campaign headlines."],
};
export function testPlan(productRef: string): CampaignPlan {
    const items = [
        {
            title: "A slower start",
            format: "feed" as const,
            scene: "A jar of Biscoff spread on a breakfast table with toast, coffee and biscuits.",
            concept: "Make the spread part of a familiar weekend breakfast.",
            headline: "",
            caption:
                "Coffee's on. Toast is warm. A little Biscoff spread, and the weekend can begin.\n\nHow do you start your Saturday?",
            dayOffset: 0,
            time: "09:00",
            includesPerson: false,
        },
        {
            title: "One more slice",
            format: "feed" as const,
            scene: "A close-up of smooth spread on crisp toast with a Biscoff jar in view.",
            concept: "Show the texture of the spread on toast.",
            headline: "",
            caption: "That familiar Biscoff taste, one slice at a time. Try it on your morning toast.",
            dayOffset: 4,
            time: "16:00",
            includesPerson: false,
        },
        {
            title: "Make yourself a morning",
            format: "feed" as const,
            scene: "A person enjoying a relaxed breakfast with Biscoff spread.",
            concept: "Put the product in a real weekend morning.",
            headline: "",
            caption: "No rush this morning. Just toast, coffee and a jar to pass around.",
            dayOffset: 7,
            time: "09:00",
            includesPerson: true,
        },
        {
            title: "Your Saturday, spread",
            format: "story" as const,
            scene: "Vertical breakfast table composition with toast and a jar of Biscoff.",
            concept: "Introduce Biscoff spread as a breakfast idea.",
            headline: "Saturday, spread.",
            caption: "A familiar taste for your weekend toast.",
            dayOffset: 1,
            time: "10:00",
            includesPerson: false,
        },
        {
            title: "From biscuit to breakfast",
            format: "story" as const,
            scene: "Show Biscoff biscuits and spread together beside toast.",
            concept: "Connect the familiar biscuit to the spread.",
            headline: "Same Biscoff. New morning.",
            caption: "Love the biscuit? Try it by the spoonful, then spread it on your toast.",
            dayOffset: 6,
            time: "16:00",
            includesPerson: false,
        },
        {
            title: "Save a seat",
            format: "story" as const,
            scene: "A person setting breakfast with Biscoff spread on a sunny table.",
            concept: "End with a shared breakfast occasion.",
            headline: "",
            caption: "Something for the weekend. Who's joining you for breakfast?",
            dayOffset: 12,
            time: "09:00",
            includesPerson: true,
        },
    ];
    return {
        title: "A taste of the weekend",
        goal: "Get people who enjoy Biscoff biscuits to try Biscoff spread.",
        audience: "Biscoff biscuit fans who have not tried the spread.",
        message: "The Biscoff taste you enjoy can be part of breakfast.",
        artDirection: "Warm window light, relaxed breakfast scenes and faithful product packaging.",
        items: items.map((item) => Object.assign(item, { referenceIds: [productRef] })),
    };
}
