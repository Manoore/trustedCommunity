import { sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";
import { colleges } from "../src/db/schema";
import { lookupCityState } from "../src/lib/geo";
import { slugify } from "../src/lib/slug";

/**
 * US universities with large international enrolment. This is a starting set,
 * not a complete directory: anyone can add a missing college from /arrive (it
 * needs a unique .edu domain), so coverage grows with use.
 *
 * The domain is the whole point - an address on it is what proves a student
 * belongs - so double-check any you add. Airports are the nearest major ones,
 * shown on arrival posts; they are a convenience, not authoritative.
 */
type Seed = { name: string; domain: string; city: string; state: string; airport: string };

const COLLEGES: Seed[] = [
  // Texas
  { name: "University of Texas at Dallas", domain: "utdallas.edu", city: "Richardson", state: "TX", airport: "DFW (Dallas/Fort Worth)" },
  { name: "University of Texas at Arlington", domain: "uta.edu", city: "Arlington", state: "TX", airport: "DFW (Dallas/Fort Worth)" },
  { name: "University of North Texas", domain: "unt.edu", city: "Denton", state: "TX", airport: "DFW (Dallas/Fort Worth)" },
  { name: "Texas A&M University", domain: "tamu.edu", city: "College Station", state: "TX", airport: "IAH Houston (about 1.5 hours away)" },
  { name: "University of Texas at Austin", domain: "utexas.edu", city: "Austin", state: "TX", airport: "AUS (Austin-Bergstrom)" },
  { name: "University of Houston", domain: "uh.edu", city: "Houston", state: "TX", airport: "IAH or HOU (Houston)" },
  { name: "Texas Tech University", domain: "ttu.edu", city: "Lubbock", state: "TX", airport: "LBB (Lubbock)" },
  { name: "University of Texas at San Antonio", domain: "utsa.edu", city: "San Antonio", state: "TX", airport: "SAT (San Antonio)" },
  // Arizona / West
  { name: "Arizona State University", domain: "asu.edu", city: "Tempe", state: "AZ", airport: "PHX (Phoenix Sky Harbor)" },
  { name: "University of Arizona", domain: "arizona.edu", city: "Tucson", state: "AZ", airport: "TUS (Tucson)" },
  { name: "University of Utah", domain: "utah.edu", city: "Salt Lake City", state: "UT", airport: "SLC (Salt Lake City)" },
  { name: "University of Colorado Boulder", domain: "colorado.edu", city: "Boulder", state: "CO", airport: "DEN (Denver)" },
  // California / Pacific
  { name: "Stanford University", domain: "stanford.edu", city: "Stanford", state: "CA", airport: "SFO or SJC" },
  { name: "University of California, Berkeley", domain: "berkeley.edu", city: "Berkeley", state: "CA", airport: "SFO or OAK" },
  { name: "San Jose State University", domain: "sjsu.edu", city: "San Jose", state: "CA", airport: "SJC (San Jose)" },
  { name: "University of California, San Diego", domain: "ucsd.edu", city: "San Diego", state: "CA", airport: "SAN (San Diego)" },
  { name: "University of California, Los Angeles", domain: "ucla.edu", city: "Los Angeles", state: "CA", airport: "LAX (Los Angeles)" },
  { name: "University of Southern California", domain: "usc.edu", city: "Los Angeles", state: "CA", airport: "LAX (Los Angeles)" },
  { name: "University of California, Irvine", domain: "uci.edu", city: "Irvine", state: "CA", airport: "SNA (John Wayne)" },
  { name: "University of Washington", domain: "uw.edu", city: "Seattle", state: "WA", airport: "SEA (Seattle-Tacoma)" },
  // Midwest
  { name: "Purdue University", domain: "purdue.edu", city: "West Lafayette", state: "IN", airport: "IND Indianapolis (about 1 hour away)" },
  { name: "Indiana University Bloomington", domain: "iu.edu", city: "Bloomington", state: "IN", airport: "IND Indianapolis (about 1 hour away)" },
  { name: "University of Illinois Urbana-Champaign", domain: "illinois.edu", city: "Urbana", state: "IL", airport: "CMI (Champaign), or ORD Chicago (about 2.5 hours)" },
  { name: "University of Illinois Chicago", domain: "uic.edu", city: "Chicago", state: "IL", airport: "ORD (O'Hare)" },
  { name: "Northwestern University", domain: "northwestern.edu", city: "Evanston", state: "IL", airport: "ORD (O'Hare)" },
  { name: "DePaul University", domain: "depaul.edu", city: "Chicago", state: "IL", airport: "ORD or MDW" },
  { name: "Illinois Institute of Technology", domain: "iit.edu", city: "Chicago", state: "IL", airport: "ORD or MDW" },
  { name: "Southern Illinois University Carbondale", domain: "siu.edu", city: "Carbondale", state: "IL", airport: "STL St. Louis (about 2 hours)" },
  { name: "University of Michigan", domain: "umich.edu", city: "Ann Arbor", state: "MI", airport: "DTW (Detroit)" },
  { name: "Michigan State University", domain: "msu.edu", city: "East Lansing", state: "MI", airport: "LAN, or DTW (about 1.5 hours)" },
  { name: "University of Wisconsin-Madison", domain: "wisc.edu", city: "Madison", state: "WI", airport: "MSN (Madison)" },
  { name: "University of Minnesota", domain: "umn.edu", city: "Minneapolis", state: "MN", airport: "MSP (Minneapolis-St. Paul)" },
  { name: "Iowa State University", domain: "iastate.edu", city: "Ames", state: "IA", airport: "DSM Des Moines (about 45 minutes)" },
  { name: "University of Missouri", domain: "missouri.edu", city: "Columbia", state: "MO", airport: "COU, or STL (about 2 hours)" },
  { name: "Missouri University of Science and Technology", domain: "mst.edu", city: "Rolla", state: "MO", airport: "STL St. Louis (about 1.5 hours)" },
  { name: "University of Kansas", domain: "ku.edu", city: "Lawrence", state: "KS", airport: "MCI (Kansas City)" },
  { name: "Kansas State University", domain: "k-state.edu", city: "Manhattan", state: "KS", airport: "MHK, or MCI (about 2 hours)" },
  { name: "Wichita State University", domain: "wichita.edu", city: "Wichita", state: "KS", airport: "ICT (Wichita)" },
  { name: "Oklahoma State University", domain: "okstate.edu", city: "Stillwater", state: "OK", airport: "OKC or TUL (about 1 hour)" },
  // Ohio
  { name: "Ohio State University", domain: "osu.edu", city: "Columbus", state: "OH", airport: "CMH (Columbus)" },
  { name: "University of Cincinnati", domain: "uc.edu", city: "Cincinnati", state: "OH", airport: "CVG (Cincinnati/Northern Kentucky)" },
  { name: "Wright State University", domain: "wright.edu", city: "Dayton", state: "OH", airport: "DAY (Dayton), CMH or CVG" },
  { name: "University of Dayton", domain: "udayton.edu", city: "Dayton", state: "OH", airport: "DAY (Dayton), CMH or CVG" },
  { name: "University of Toledo", domain: "utoledo.edu", city: "Toledo", state: "OH", airport: "DTW Detroit (about 1 hour)" },
  { name: "Cleveland State University", domain: "csuohio.edu", city: "Cleveland", state: "OH", airport: "CLE (Cleveland)" },
  { name: "Kent State University", domain: "kent.edu", city: "Kent", state: "OH", airport: "CLE (about 45 minutes)" },
  { name: "University of Akron", domain: "uakron.edu", city: "Akron", state: "OH", airport: "CAK, or CLE (about 45 minutes)" },
  // South / Southeast
  { name: "Georgia Institute of Technology", domain: "gatech.edu", city: "Atlanta", state: "GA", airport: "ATL (Hartsfield-Jackson)" },
  { name: "Georgia State University", domain: "gsu.edu", city: "Atlanta", state: "GA", airport: "ATL (Hartsfield-Jackson)" },
  { name: "University of Georgia", domain: "uga.edu", city: "Athens", state: "GA", airport: "ATL (about 1.5 hours)" },
  { name: "North Carolina State University", domain: "ncsu.edu", city: "Raleigh", state: "NC", airport: "RDU (Raleigh-Durham)" },
  { name: "Virginia Tech", domain: "vt.edu", city: "Blacksburg", state: "VA", airport: "ROA Roanoke (about 45 minutes)" },
  { name: "University of Florida", domain: "ufl.edu", city: "Gainesville", state: "FL", airport: "GNV, or MCO (about 2 hours)" },
  { name: "University of Central Florida", domain: "ucf.edu", city: "Orlando", state: "FL", airport: "MCO (Orlando)" },
  { name: "University of South Florida", domain: "usf.edu", city: "Tampa", state: "FL", airport: "TPA (Tampa)" },
  { name: "Clemson University", domain: "clemson.edu", city: "Clemson", state: "SC", airport: "GSP (Greenville-Spartanburg)" },
  { name: "University of South Carolina", domain: "sc.edu", city: "Columbia", state: "SC", airport: "CAE (Columbia)" },
  { name: "University of Memphis", domain: "memphis.edu", city: "Memphis", state: "TN", airport: "MEM (Memphis)" },
  // Northeast / Mid-Atlantic
  { name: "University of Massachusetts Amherst", domain: "umass.edu", city: "Amherst", state: "MA", airport: "BDL Hartford (about 1 hour), or BOS" },
  { name: "Northeastern University", domain: "northeastern.edu", city: "Boston", state: "MA", airport: "BOS (Logan)" },
  { name: "Boston University", domain: "bu.edu", city: "Boston", state: "MA", airport: "BOS (Logan)" },
  { name: "Harvard University", domain: "harvard.edu", city: "Cambridge", state: "MA", airport: "BOS (Logan)" },
  { name: "Massachusetts Institute of Technology", domain: "mit.edu", city: "Cambridge", state: "MA", airport: "BOS (Logan)" },
  { name: "New York University", domain: "nyu.edu", city: "New York", state: "NY", airport: "JFK, EWR or LGA" },
  { name: "Columbia University", domain: "columbia.edu", city: "New York", state: "NY", airport: "JFK, EWR or LGA" },
  { name: "Cornell University", domain: "cornell.edu", city: "Ithaca", state: "NY", airport: "ITH, or SYR (about 1 hour)" },
  { name: "Stony Brook University", domain: "stonybrook.edu", city: "Stony Brook", state: "NY", airport: "JFK, or ISP (Long Island MacArthur)" },
  { name: "University at Buffalo", domain: "buffalo.edu", city: "Buffalo", state: "NY", airport: "BUF (Buffalo Niagara)" },
  { name: "Syracuse University", domain: "syr.edu", city: "Syracuse", state: "NY", airport: "SYR (Syracuse)" },
  { name: "Rutgers University", domain: "rutgers.edu", city: "New Brunswick", state: "NJ", airport: "EWR (Newark)" },
  { name: "Stevens Institute of Technology", domain: "stevens.edu", city: "Hoboken", state: "NJ", airport: "EWR (Newark)" },
  { name: "New Jersey Institute of Technology", domain: "njit.edu", city: "Newark", state: "NJ", airport: "EWR (Newark)" },
  { name: "Carnegie Mellon University", domain: "cmu.edu", city: "Pittsburgh", state: "PA", airport: "PIT (Pittsburgh)" },
  { name: "University of Pittsburgh", domain: "pitt.edu", city: "Pittsburgh", state: "PA", airport: "PIT (Pittsburgh)" },
  { name: "Pennsylvania State University", domain: "psu.edu", city: "State College", state: "PA", airport: "SCE, or PIT (about 2.5 hours)" },
  { name: "University of Maryland, College Park", domain: "umd.edu", city: "College Park", state: "MD", airport: "DCA, IAD or BWI" },
];

async function main() {
  const rows = COLLEGES.map((c) => {
    const geo = lookupCityState(`${c.city}, ${c.state}`);
    if (!geo) console.warn(`No coordinates for ${c.city}, ${c.state}`);
    return {
      slug: slugify(c.name),
      name: c.name,
      city: c.city,
      state: c.state,
      country: "US",
      domain: c.domain,
      airport: c.airport,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
    };
  });

  // One round trip, and safe to re-run: the domain is the natural key.
  await db
    .insert(colleges)
    .values(rows)
    .onConflictDoUpdate({
      target: colleges.domain,
      set: {
        name: sql`excluded.name`,
        city: sql`excluded.city`,
        state: sql`excluded.state`,
        airport: sql`excluded.airport`,
        lat: sql`excluded.lat`,
        lng: sql`excluded.lng`,
      },
    });

  console.log(`Seeded ${rows.length} colleges.`);
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
