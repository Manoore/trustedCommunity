/**
 * Nationwide, all-category taxonomy.
 *
 * `licenseRequired` marks trades where most states demand a licence before the
 * work may legally be advertised or performed. Listings in those categories
 * must carry a licence number and stay in `pending` until an admin approves the
 * matching verification record.
 *
 * `restricted` marks categories we will not host at all. Two reasons:
 *  - Heavily regulated advice (legal, medical, investment) carries liability we
 *    are not set up to police, and several states treat referral fees in those
 *    fields as fee-splitting.
 *  - Personals and adult services fall inside the FOSTA/SESTA carve-out to
 *    Section 230, which strips the immunity that protects the rest of the site.
 * They exist in the tree so search can explain the refusal instead of returning
 * a confusing empty page.
 */
export type CategorySeed = {
  slug: string;
  name: string;
  description?: string;
  licenseRequired?: boolean;
  restricted?: boolean;
  /** Healthcare/legal: hidden until ENABLE_PROFESSIONAL_CATEGORIES is set. */
  professional?: boolean;
  children?: CategorySeed[];
};

const L = true; // licence required in most states

export const CATEGORY_TREE: CategorySeed[] = [
  {
    slug: "home-improvement",
    name: "Home Improvement & Repair",
    description: "Contractors and trades that work on the building itself.",
    children: [
      { slug: "general-contracting", name: "General Contracting", licenseRequired: L },
      { slug: "plumbing", name: "Plumbing", licenseRequired: L },
      { slug: "electrical", name: "Electrical", licenseRequired: L },
      { slug: "hvac", name: "Heating & Air Conditioning", licenseRequired: L },
      { slug: "roofing", name: "Roofing", licenseRequired: L },
      { slug: "solar-installation", name: "Solar Installation", licenseRequired: L },
      { slug: "home-inspection", name: "Home Inspection", licenseRequired: L },
      { slug: "handyman", name: "Handyman" },
      { slug: "painting", name: "Painting" },
      { slug: "flooring", name: "Flooring & Carpet" },
      { slug: "drywall", name: "Drywall & Plaster" },
      { slug: "carpentry", name: "Carpentry & Cabinetry" },
      { slug: "concrete-masonry", name: "Concrete & Masonry" },
      { slug: "windows-doors", name: "Windows & Doors" },
      { slug: "garage-doors", name: "Garage Doors" },
      { slug: "fencing", name: "Fencing & Decking" },
      { slug: "gutters", name: "Gutters & Siding" },
      { slug: "remodeling-kitchen-bath", name: "Kitchen & Bath Remodeling" },
      { slug: "insulation", name: "Insulation & Weatherproofing" },
      { slug: "foundation-repair", name: "Foundation & Waterproofing" },
    ],
  },
  {
    slug: "home-services",
    name: "Home & Property Services",
    description: "Recurring upkeep rather than construction.",
    children: [
      { slug: "house-cleaning", name: "House Cleaning" },
      { slug: "commercial-cleaning", name: "Commercial & Janitorial Cleaning" },
      { slug: "carpet-cleaning", name: "Carpet & Upholstery Cleaning" },
      { slug: "pressure-washing", name: "Pressure Washing" },
      { slug: "window-cleaning", name: "Window Cleaning" },
      { slug: "landscaping", name: "Landscaping & Hardscaping" },
      { slug: "lawn-care", name: "Lawn Care" },
      { slug: "tree-service", name: "Tree Service & Arborists" },
      { slug: "irrigation", name: "Irrigation & Sprinklers" },
      { slug: "pest-control", name: "Pest Control", licenseRequired: L },
      { slug: "pool-spa-service", name: "Pool & Spa Service" },
      { slug: "appliance-repair", name: "Appliance Repair" },
      { slug: "locksmith", name: "Locksmith", licenseRequired: L },
      { slug: "junk-removal", name: "Junk Removal & Hauling" },
      { slug: "moving", name: "Movers" },
      { slug: "storage", name: "Storage & Organization" },
      { slug: "chimney-sweep", name: "Chimney & Fireplace" },
      { slug: "septic-services", name: "Septic & Sewer", licenseRequired: L },
      { slug: "snow-removal", name: "Snow Removal" },
      { slug: "property-management", name: "Property Management", licenseRequired: L },
    ],
  },
  {
    slug: "automotive",
    name: "Automotive",
    children: [
      { slug: "auto-repair", name: "Auto Repair" },
      { slug: "mobile-mechanic", name: "Mobile Mechanic" },
      { slug: "auto-body", name: "Auto Body & Collision" },
      { slug: "auto-detailing", name: "Detailing & Car Wash" },
      { slug: "tires-wheels", name: "Tires & Wheels" },
      { slug: "oil-change", name: "Oil Change & Maintenance" },
      { slug: "windshield-glass", name: "Auto Glass" },
      { slug: "towing", name: "Towing & Roadside Assistance" },
      { slug: "transmission", name: "Transmission & Drivetrain" },
      { slug: "auto-electrical", name: "Auto Electrical & Diagnostics" },
      { slug: "motorcycle-repair", name: "Motorcycle & Powersports" },
      { slug: "rv-boat-repair", name: "RV & Marine Service" },
      { slug: "fleet-services", name: "Fleet & Commercial Vehicle" },
      { slug: "auto-customization", name: "Customization & Performance" },
    ],
  },
  {
    slug: "beauty-wellness",
    name: "Beauty & Wellness",
    children: [
      { slug: "hair-styling", name: "Hair Styling & Color", licenseRequired: L },
      { slug: "barbering", name: "Barbering", licenseRequired: L },
      { slug: "nail-services", name: "Nail Services", licenseRequired: L },
      { slug: "esthetics-skincare", name: "Esthetics & Skincare", licenseRequired: L },
      { slug: "lashes-brows", name: "Lashes & Brows", licenseRequired: L },
      { slug: "makeup-artistry", name: "Makeup Artistry" },
      { slug: "massage-therapy", name: "Massage Therapy", licenseRequired: L },
      { slug: "tattoo-piercing", name: "Tattoo & Piercing", licenseRequired: L },
      { slug: "hair-removal", name: "Waxing & Laser Hair Removal", licenseRequired: L },
      { slug: "spa-services", name: "Spa & Body Treatments" },
      { slug: "personal-training", name: "Personal Training" },
      { slug: "yoga-pilates", name: "Yoga & Pilates" },
      { slug: "nutrition-coaching", name: "Nutrition & Wellness Coaching" },
      { slug: "life-coaching", name: "Life & Career Coaching" },
    ],
  },
  {
    slug: "events",
    name: "Events & Entertainment",
    children: [
      { slug: "photography", name: "Photography" },
      { slug: "videography", name: "Videography" },
      { slug: "dj-services", name: "DJs" },
      { slug: "live-music", name: "Live Music & Bands" },
      { slug: "catering", name: "Catering" },
      { slug: "bartending", name: "Bartending", licenseRequired: L },
      { slug: "event-planning", name: "Event & Wedding Planning" },
      { slug: "florist", name: "Florists" },
      { slug: "cakes-desserts", name: "Cakes & Desserts" },
      { slug: "party-rentals", name: "Party & Equipment Rentals" },
      { slug: "photo-booth", name: "Photo Booths" },
      { slug: "officiants", name: "Officiants" },
      { slug: "event-staffing", name: "Event Staffing" },
      { slug: "entertainers", name: "Entertainers & Performers" },
      { slug: "venues", name: "Venues" },
    ],
  },
  {
    slug: "creative-digital",
    name: "Creative & Digital",
    description: "Mostly remote work - these listings reach the whole country.",
    children: [
      { slug: "graphic-design", name: "Graphic Design" },
      { slug: "web-development", name: "Web Development" },
      { slug: "app-development", name: "Mobile App Development" },
      { slug: "software-consulting", name: "Software & Cloud Consulting" },
      { slug: "seo", name: "SEO & Search Marketing" },
      { slug: "social-media-management", name: "Social Media Management" },
      { slug: "copywriting", name: "Copywriting & Content" },
      { slug: "video-editing", name: "Video Editing & Motion" },
      { slug: "animation", name: "Animation & 3D" },
      { slug: "illustration", name: "Illustration" },
      { slug: "branding", name: "Branding & Identity" },
      { slug: "ux-design", name: "UX & Product Design" },
      { slug: "audio-production", name: "Audio Production & Voiceover" },
      { slug: "it-support", name: "IT Support & Networking" },
      { slug: "data-analytics", name: "Data & Analytics" },
      { slug: "ai-automation", name: "AI & Automation" },
      { slug: "ecommerce-setup", name: "E-commerce Setup" },
    ],
  },
  {
    slug: "professional-services",
    name: "Professional & Business Services",
    children: [
      { slug: "bookkeeping", name: "Bookkeeping" },
      { slug: "accounting-cpa", name: "Accounting & CPA", licenseRequired: L },
      { slug: "tax-preparation", name: "Tax Preparation", licenseRequired: L },
      { slug: "payroll-services", name: "Payroll Services" },
      { slug: "notary", name: "Notary Public", licenseRequired: L },
      { slug: "business-consulting", name: "Business Consulting" },
      { slug: "hr-consulting", name: "HR & Recruiting" },
      { slug: "marketing-consulting", name: "Marketing Consulting" },
      { slug: "virtual-assistant", name: "Virtual Assistants" },
      { slug: "translation", name: "Translation & Interpretation" },
      { slug: "resume-writing", name: "Resume & Career Services" },
      { slug: "grant-writing", name: "Grant & Proposal Writing" },
      { slug: "architecture", name: "Architecture", licenseRequired: L },
      { slug: "engineering", name: "Engineering", licenseRequired: L },
      { slug: "surveying", name: "Land Surveying", licenseRequired: L },
      { slug: "insurance-agents", name: "Insurance Agents", licenseRequired: L },
      { slug: "real-estate-agents", name: "Real Estate Agents", licenseRequired: L },
      { slug: "printing-signage", name: "Printing & Signage" },
      { slug: "courier-delivery", name: "Courier & Delivery" },
      { slug: "security-services", name: "Security Services", licenseRequired: L },
    ],
  },
  {
    slug: "education",
    name: "Education & Lessons",
    children: [
      { slug: "academic-tutoring", name: "Academic Tutoring" },
      { slug: "test-prep", name: "Test Prep" },
      { slug: "music-lessons", name: "Music Lessons" },
      { slug: "language-lessons", name: "Language Lessons" },
      { slug: "art-lessons", name: "Art & Craft Lessons" },
      { slug: "coding-lessons", name: "Coding & Tech Lessons" },
      { slug: "sports-coaching", name: "Sports Coaching" },
      { slug: "dance-lessons", name: "Dance Lessons" },
      { slug: "driving-instruction", name: "Driving Instruction", licenseRequired: L },
      { slug: "special-education", name: "Special Education Support", licenseRequired: L },
      { slug: "college-admissions", name: "College Admissions Advising" },
      { slug: "corporate-training", name: "Corporate Training" },
    ],
  },
  {
    slug: "pets",
    name: "Pets & Animals",
    children: [
      { slug: "dog-walking", name: "Dog Walking" },
      { slug: "pet-sitting", name: "Pet Sitting & Boarding" },
      { slug: "pet-grooming", name: "Pet Grooming" },
      { slug: "dog-training", name: "Dog Training" },
      { slug: "veterinary", name: "Veterinary Services", licenseRequired: L },
      { slug: "mobile-vet", name: "Mobile Veterinary", licenseRequired: L },
      { slug: "pet-transport", name: "Pet Transport" },
      { slug: "equine-services", name: "Equine Services" },
      { slug: "pet-waste-removal", name: "Pet Waste Removal" },
    ],
  },
  {
    slug: "care-services",
    name: "Care Services",
    children: [
      { slug: "childcare-nanny", name: "Childcare & Nannies" },
      { slug: "babysitting", name: "Babysitting" },
      { slug: "senior-care", name: "Senior Care & Companionship" },
      { slug: "home-health-aide", name: "Home Health Aides", licenseRequired: L },
      { slug: "doula-services", name: "Doula & Postpartum Support", licenseRequired: L },
      { slug: "special-needs-care", name: "Special Needs Care", licenseRequired: L },
      { slug: "housekeeping-staff", name: "Household Staffing" },
    ],
  },
  {
    slug: "labor-trades",
    name: "Skilled Labor & Trades",
    children: [
      { slug: "welding", name: "Welding & Metalwork" },
      { slug: "machining", name: "Machining & Fabrication" },
      { slug: "general-labor", name: "General Labor" },
      { slug: "warehouse-staffing", name: "Warehouse & Logistics Staffing" },
      { slug: "trucking", name: "Trucking & Freight", licenseRequired: L },
      { slug: "heavy-equipment", name: "Heavy Equipment Operation", licenseRequired: L },
      { slug: "demolition", name: "Demolition & Excavation", licenseRequired: L },
      { slug: "furniture-assembly", name: "Furniture Assembly" },
      { slug: "upholstery", name: "Upholstery & Restoration" },
      { slug: "sewing-alterations", name: "Sewing & Alterations" },
    ],
  },
  {
    slug: "newcomer-essentials",
    name: "Newcomer Essentials",
    description: "What most people need in their first weeks somewhere new.",
    children: [
      { slug: "ethnic-grocery", name: "Grocery & Food from Home" },
      { slug: "mobile-plans", name: "Phone & Internet Plans" },
      { slug: "banking-remittance", name: "Banking & Sending Money" },
      { slug: "driving-school", name: "Driving Lessons" },
      { slug: "furniture-rental", name: "Furniture & Household Setup" },
      { slug: "community-centres", name: "Community Centres & Places of Worship" },
    ],
  },
  {
    slug: "documents-paperwork",
    name: "Documents & Paperwork",
    description: "The attestations, translations and photos every move seems to need.",
    children: [
      { slug: "document-attestation", name: "Document Attestation" },
      { slug: "apostille-legalization", name: "Apostille & Legalization" },
      { slug: "passport-photos", name: "Passport & ID Photos" },
    ],
  },
  {
    slug: "family-back-home",
    name: "Family & Property Back Home",
    description:
      "Trusted people in another country: someone to look after a parent, a property, or paperwork you cannot do from here.",
    children: [
      { slug: "remote-property-care", name: "Property Care for Owners Abroad" },
      { slug: "parents-care-coordination", name: "Care for Parents Abroad" },
      { slug: "cross-border-tax", name: "Cross-Border Tax Help", licenseRequired: L },
      { slug: "parcel-forwarding", name: "Courier & Parcel Forwarding" },
      { slug: "overseas-local-services", name: "Local Services Abroad" },
    ],
  },
  {
    slug: "healthcare",
    name: "Healthcare",
    professional: true,
    description:
      "Contact details only — book through their own website or portal. Not medical advice, and not for emergencies.",
    children: [
      { slug: "family-doctor", name: "Family Doctor", professional: true, licenseRequired: L },
      { slug: "pediatrician", name: "Pediatrician", professional: true, licenseRequired: L },
      { slug: "dentist", name: "Dentist", professional: true, licenseRequired: L },
      { slug: "eye-care", name: "Eye Care", professional: true, licenseRequired: L },
      { slug: "physiotherapy", name: "Physiotherapy", professional: true, licenseRequired: L },
      { slug: "pharmacy", name: "Pharmacy", professional: true, licenseRequired: L },
      { slug: "urgent-care", name: "Urgent Care Clinic", professional: true, licenseRequired: L },
    ],
  },
  {
    slug: "legal-professional",
    name: "Legal",
    professional: true,
    description:
      "Contact details only — contact them directly. Not legal advice. Licensed attorneys only; beware anyone offering immigration help who is not.",
    children: [
      { slug: "immigration-attorney", name: "Immigration Attorney (licensed only)", professional: true, licenseRequired: L },
      { slug: "family-law-attorney", name: "Family Law Attorney", professional: true, licenseRequired: L },
      { slug: "real-estate-attorney", name: "Real Estate Attorney", professional: true, licenseRequired: L },
      { slug: "business-attorney", name: "Business Attorney", professional: true, licenseRequired: L },
    ],
  },
  {
    slug: "business-promotion",
    name: "Business Promotion",
    description:
      "For businesses advertising themselves rather than selling a single service.",
    children: [
      { slug: "restaurants-food", name: "Restaurants & Food" },
      { slug: "retail-shops", name: "Retail Shops" },
      { slug: "fitness-studios", name: "Gyms & Fitness Studios" },
      { slug: "salons-spas", name: "Salons & Spas" },
      { slug: "auto-dealers", name: "Auto Dealers" },
      { slug: "professional-offices", name: "Professional Offices" },
      { slug: "franchises", name: "Franchise Opportunities" },
      { slug: "wholesale-suppliers", name: "Wholesale & Suppliers" },
      { slug: "local-attractions", name: "Local Attractions & Tours" },
      { slug: "nonprofits", name: "Nonprofits & Community" },
    ],
  },
  {
    slug: "restricted",
    name: "Not Accepted",
    description:
      "Categories this marketplace does not host. Listed so search can say why.",
    restricted: true,
    children: [
      {
        slug: "legal-services",
        name: "Legal Services",
        restricted: true,
        description:
          "State bar rules on referral fees and fee-splitting make lead-gen for lawyers a licensing problem.",
      },
      {
        slug: "medical-dental",
        name: "Medical & Dental",
        restricted: true,
        description: "HIPAA exposure and state anti-kickback statutes.",
      },
      {
        slug: "financial-advisory",
        name: "Investment & Financial Advice",
        restricted: true,
        description: "SEC and state registration requirements for adviser referrals.",
      },
      {
        slug: "immigration-consulting",
        name: "Immigration Consulting",
        restricted: true,
        description: "Notario fraud statutes in most states.",
      },
      {
        slug: "firearms",
        name: "Firearms & Ammunition",
        restricted: true,
        description: "ATF transfer rules; payment processors decline the category.",
      },
      {
        slug: "cannabis-cbd",
        name: "Cannabis & CBD",
        restricted: true,
        description: "Still federally scheduled; processors decline.",
      },
      {
        slug: "adult-services",
        name: "Adult Services",
        restricted: true,
        description:
          "FOSTA/SESTA carves this out of Section 230 immunity for the whole site.",
      },
      {
        slug: "personals",
        name: "Personals & Dating",
        restricted: true,
        description: "Same FOSTA/SESTA exposure as adult services.",
      },
    ],
  },
];

/** Categories where a remote provider legitimately serves the whole country. */
export const REMOTE_FRIENDLY_GROUPS = new Set([
  "creative-digital",
  "professional-services",
  "education",
]);

export function flattenCategories(
  tree: CategorySeed[] = CATEGORY_TREE,
): CategorySeed[] {
  const out: CategorySeed[] = [];
  const walk = (nodes: CategorySeed[]) => {
    for (const node of nodes) {
      out.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(tree);
  return out;
}
