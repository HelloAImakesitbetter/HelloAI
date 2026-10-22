export type WebsiteTemplate = {
  id: string;
  name: string;
  category: string;
  icon: string;
  accent: string;
  summary: string;
  pages: string[];
  brief: {
    industry: string;
    description: string;
    services: string;
    audience: string;
    tone: string;
    primaryAction: string;
  };
};

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  { id: "local-services", name: "Local services", category: "Home & trades", icon: "🛠️", accent: "#1f6f4a", summary: "Cleaners, plumbers, electricians and other trades that win work by area.", pages: ["Home", "Services", "About", "Service areas", "Contact"], brief: { industry: "Home services", description: "A trusted local service business that helps nearby homeowners with reliable, fairly priced work.", services: "Main service, emergency call-outs, free quotes", audience: "Homeowners and landlords in the local area", tone: "Friendly, practical and reassuring", primaryAction: "Request a free quote" } },
  { id: "restaurant", name: "Restaurant & cafe", category: "Food & drink", icon: "🍽️", accent: "#b4532a", summary: "Menu, opening hours, location and table or takeaway enquiries.", pages: ["Home", "Menu", "About", "Gallery", "Book a table"], brief: { industry: "Restaurant", description: "A welcoming restaurant serving fresh, seasonal food with a relaxed atmosphere.", services: "Dine-in, takeaway, private events, catering", audience: "Locals, families and visitors looking for a great meal", tone: "Warm, appetising and inviting", primaryAction: "Book a table" } },
  { id: "salon", name: "Beauty & wellness", category: "Health & beauty", icon: "💆", accent: "#a04668", summary: "Salons, spas, barbers and therapists with treatments and booking.", pages: ["Home", "Treatments", "Pricing", "About", "Book now"], brief: { industry: "Beauty salon", description: "A calm, professional salon offering treatments that help clients look and feel their best.", services: "Hair, nails, facials, massage, gift vouchers", audience: "Adults looking for quality treatments close to home", tone: "Elegant, calm and personal", primaryAction: "Book an appointment" } },
  { id: "agency", name: "Agency & consultancy", category: "Professional", icon: "💼", accent: "#2d4a8a", summary: "Consultants, marketers and studios who sell expertise and outcomes.", pages: ["Home", "Services", "Work", "About", "Contact"], brief: { industry: "Consultancy", description: "A small expert team that helps businesses solve a specific problem and get measurable results.", services: "Strategy, delivery, ongoing support", audience: "Small and mid-sized business owners and managers", tone: "Confident, clear and no-jargon", primaryAction: "Book a discovery call" } },
  { id: "ecommerce", name: "Online shop", category: "Retail", icon: "🛍️", accent: "#6b3fa0", summary: "A brand story, product categories, shipping info and support pages.", pages: ["Home", "Shop", "About", "Shipping & returns", "Contact"], brief: { industry: "Online retail", description: "An independent online brand selling carefully chosen products with fast, friendly service.", services: "Product range, gift options, delivery and returns", audience: "Shoppers who value quality and independent brands", tone: "Fresh, confident and friendly", primaryAction: "Shop the collection" } },
  { id: "fitness", name: "Fitness & coaching", category: "Health & beauty", icon: "🏋️", accent: "#c2410c", summary: "Gyms, personal trainers and coaches with programmes and sign-up.", pages: ["Home", "Programmes", "About", "Pricing", "Join"], brief: { industry: "Fitness coaching", description: "A supportive coaching and training service that helps people build strength and healthy habits.", services: "Personal training, group classes, online coaching", audience: "Adults who want structure, accountability and results", tone: "Motivating, honest and encouraging", primaryAction: "Start with a free consultation" } },
  { id: "property", name: "Property & lettings", category: "Professional", icon: "🏡", accent: "#0f766e", summary: "Estate agents, landlords and property managers with local pages.", pages: ["Home", "Properties", "Landlords", "Areas we cover", "Contact"], brief: { industry: "Property services", description: "A local property business helping people buy, sell, rent and manage homes with clear communication.", services: "Lettings, sales, property management, valuations", audience: "Buyers, sellers, tenants and landlords", tone: "Professional, trustworthy and clear", primaryAction: "Book a free valuation" } },
  { id: "portfolio", name: "Portfolio & creative", category: "Creative", icon: "🎨", accent: "#111827", summary: "Photographers, designers and freelancers showing their best work.", pages: ["Home", "Work", "About", "Services", "Contact"], brief: { industry: "Creative freelancer", description: "An independent creative who produces distinctive work for clients and brands.", services: "Commissions, collaborations, ongoing projects", audience: "Brands and individuals looking for a creative partner", tone: "Distinctive, polished and personal", primaryAction: "Get in touch about a project" } },
];
