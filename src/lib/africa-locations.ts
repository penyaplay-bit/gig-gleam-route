// African countries with major cities. SADC members listed first (priority),
// then the rest of Africa alphabetically.

export interface CountryEntry {
  name: string;
  cities: string[];
  sadc?: boolean;
}

export const SADC_COUNTRIES: CountryEntry[] = [
  { name: "Lesotho", sadc: true, cities: ["Maseru", "Leribe", "Mafeteng", "Mohale's Hoek", "Quthing", "Thaba-Tseka", "Mokhotlong", "Qacha's Nek", "Butha-Buthe", "Berea"] },
  { name: "South Africa", sadc: true, cities: ["Johannesburg", "Pretoria", "Cape Town", "Durban", "Bloemfontein", "Port Elizabeth", "East London", "Polokwane", "Nelspruit", "Kimberley", "Rustenburg", "Welkom", "Mbombela", "Soweto", "Sandton"] },
  { name: "Botswana", sadc: true, cities: ["Gaborone", "Francistown", "Maun", "Molepolole", "Serowe", "Kanye", "Selibe Phikwe", "Palapye"] },
  { name: "Namibia", sadc: true, cities: ["Windhoek", "Walvis Bay", "Swakopmund", "Oshakati", "Rundu", "Katima Mulilo"] },
  { name: "Zimbabwe", sadc: true, cities: ["Harare", "Bulawayo", "Chitungwiza", "Mutare", "Gweru", "Kwekwe", "Kadoma", "Masvingo", "Victoria Falls"] },
  { name: "Zambia", sadc: true, cities: ["Lusaka", "Ndola", "Kitwe", "Kabwe", "Chingola", "Livingstone", "Mufulira", "Solwezi"] },
  { name: "Mozambique", sadc: true, cities: ["Maputo", "Matola", "Beira", "Nampula", "Chimoio", "Nacala", "Quelimane", "Tete", "Pemba"] },
  { name: "Malawi", sadc: true, cities: ["Lilongwe", "Blantyre", "Mzuzu", "Zomba", "Kasungu", "Mangochi"] },
  { name: "Angola", sadc: true, cities: ["Luanda", "Huambo", "Lobito", "Benguela", "Lubango", "Cabinda"] },
  { name: "Tanzania", sadc: true, cities: ["Dar es Salaam", "Dodoma", "Mwanza", "Arusha", "Zanzibar City", "Mbeya", "Morogoro", "Tanga"] },
  { name: "Eswatini", sadc: true, cities: ["Mbabane", "Manzini", "Lobamba", "Big Bend", "Nhlangano"] },
  { name: "Madagascar", sadc: true, cities: ["Antananarivo", "Toamasina", "Antsirabe", "Mahajanga", "Fianarantsoa", "Toliara"] },
  { name: "Mauritius", sadc: true, cities: ["Port Louis", "Beau Bassin-Rose Hill", "Vacoas-Phoenix", "Curepipe", "Quatre Bornes"] },
  { name: "DR Congo", sadc: true, cities: ["Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Kananga", "Kisangani", "Bukavu", "Goma"] },
  { name: "Seychelles", sadc: true, cities: ["Victoria", "Anse Boileau", "Beau Vallon"] },
  { name: "Comoros", sadc: true, cities: ["Moroni", "Mutsamudu", "Fomboni"] },
];

export const OTHER_AFRICA: CountryEntry[] = [
  { name: "Algeria", cities: ["Algiers", "Oran", "Constantine", "Annaba"] },
  { name: "Benin", cities: ["Cotonou", "Porto-Novo", "Parakou"] },
  { name: "Burkina Faso", cities: ["Ouagadougou", "Bobo-Dioulasso"] },
  { name: "Burundi", cities: ["Bujumbura", "Gitega"] },
  { name: "Cameroon", cities: ["Yaoundé", "Douala", "Bafoussam", "Garoua"] },
  { name: "Cape Verde", cities: ["Praia", "Mindelo"] },
  { name: "Central African Republic", cities: ["Bangui"] },
  { name: "Chad", cities: ["N'Djamena", "Moundou"] },
  { name: "Côte d'Ivoire", cities: ["Abidjan", "Yamoussoukro", "Bouaké"] },
  { name: "Djibouti", cities: ["Djibouti City"] },
  { name: "Egypt", cities: ["Cairo", "Alexandria", "Giza", "Sharm El Sheikh", "Luxor"] },
  { name: "Equatorial Guinea", cities: ["Malabo", "Bata"] },
  { name: "Eritrea", cities: ["Asmara", "Massawa"] },
  { name: "Ethiopia", cities: ["Addis Ababa", "Dire Dawa", "Mekelle", "Bahir Dar"] },
  { name: "Gabon", cities: ["Libreville", "Port-Gentil"] },
  { name: "Gambia", cities: ["Banjul", "Serekunda"] },
  { name: "Ghana", cities: ["Accra", "Kumasi", "Tamale", "Takoradi"] },
  { name: "Guinea", cities: ["Conakry", "Nzérékoré"] },
  { name: "Guinea-Bissau", cities: ["Bissau"] },
  { name: "Kenya", cities: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"] },
  { name: "Liberia", cities: ["Monrovia", "Gbarnga"] },
  { name: "Libya", cities: ["Tripoli", "Benghazi", "Misrata"] },
  { name: "Mali", cities: ["Bamako", "Sikasso", "Timbuktu"] },
  { name: "Mauritania", cities: ["Nouakchott", "Nouadhibou"] },
  { name: "Morocco", cities: ["Casablanca", "Rabat", "Marrakesh", "Fez", "Tangier"] },
  { name: "Niger", cities: ["Niamey", "Zinder"] },
  { name: "Nigeria", cities: ["Lagos", "Abuja", "Kano", "Ibadan", "Port Harcourt", "Benin City"] },
  { name: "Republic of Congo", cities: ["Brazzaville", "Pointe-Noire"] },
  { name: "Rwanda", cities: ["Kigali", "Butare", "Gisenyi"] },
  { name: "São Tomé and Príncipe", cities: ["São Tomé"] },
  { name: "Senegal", cities: ["Dakar", "Thiès", "Saint-Louis"] },
  { name: "Sierra Leone", cities: ["Freetown", "Bo", "Kenema"] },
  { name: "Somalia", cities: ["Mogadishu", "Hargeisa", "Kismayo"] },
  { name: "South Sudan", cities: ["Juba", "Wau"] },
  { name: "Sudan", cities: ["Khartoum", "Omdurman", "Port Sudan"] },
  { name: "Togo", cities: ["Lomé", "Sokodé"] },
  { name: "Tunisia", cities: ["Tunis", "Sfax", "Sousse"] },
  { name: "Uganda", cities: ["Kampala", "Entebbe", "Jinja", "Gulu"] },
];

export const AFRICA_COUNTRIES: CountryEntry[] = [...SADC_COUNTRIES, ...OTHER_AFRICA];

export function citiesFor(country: string): string[] {
  return AFRICA_COUNTRIES.find((c) => c.name === country)?.cities ?? [];
}
