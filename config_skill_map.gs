/**
 * Skill configuration taken from Bitjita / Bitcraft.
 * Keys are stringified skill IDs.
 */
const skillMap = {
  "1":  { id: 1,  name: "ANY",          title: "",          skillCategoryStr: "None" },
  "2":  { id: 2,  name: "Forestry",     title: "Forester",  skillCategoryStr: "Profession" },
  "3":  { id: 3,  name: "Carpentry",    title: "Carpenter", skillCategoryStr: "Profession" },
  "4":  { id: 4,  name: "Masonry",      title: "Mason",     skillCategoryStr: "Profession" },
  "5":  { id: 5,  name: "Mining",       title: "Miner",     skillCategoryStr: "Profession" },
  "6":  { id: 6,  name: "Smithing",     title: "Smith",     skillCategoryStr: "Profession" },
  "7":  { id: 7,  name: "Scholar",      title: "Scholar",   skillCategoryStr: "Profession" },
  "8":  { id: 8,  name: "Leatherworking", title: "Leatherworker", skillCategoryStr: "Profession" },
  "9":  { id: 9,  name: "Hunting",      title: "Hunter",    skillCategoryStr: "Profession" },
  "10": { id: 10, name: "Tailoring",    title: "Tailor",    skillCategoryStr: "Profession" },
  "11": { id: 11, name: "Farming",      title: "Farmer",    skillCategoryStr: "Profession" },
  "12": { id: 12, name: "Fishing",      title: "Fisher",    skillCategoryStr: "Profession" },
  "13": { id: 13, name: "Cooking",      title: "Cook",      skillCategoryStr: "Adventure" },
  "14": { id: 14, name: "Foraging",     title: "Forager",   skillCategoryStr: "Profession" },
  "15": { id: 15, name: "Construction", title: "Builder",   skillCategoryStr: "Adventure" },
  "17": { id: 17, name: "Taming",       title: "Tamer",     skillCategoryStr: "Adventure" },
  "18": { id: 18, name: "Slayer",       title: "Slayer",    skillCategoryStr: "Adventure" },
  "19": { id: 19, name: "Merchanting",  title: "Merchant",  skillCategoryStr: "Adventure" },
  "21": { id: 21, name: "Sailing",      title: "Sailor",    skillCategoryStr: "Adventure" }
};

/**
 * Header shorthands for stat sheet columns.
 * Allows things like "Leatherwork" → "Leatherworking".
 */
const STAT_HEADER_SHORTHANDS = {
  "Leatherwork": "Leatherworking",
  "Merchant": "Merchanting"
};
