/**
 * NFL Games API utility
 * Fetches upcoming NFL games and their locations
 */

export interface NFLGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  stadium: string;
  city: string;
  state: string;
  location: {
    lat: number;
    lon: number;
  };
}

export interface StadiumLocation {
  name: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
}

/**
 * Stadium coordinates for NFL teams
 * Using approximate coordinates for major NFL stadiums
 */
const STADIUM_LOCATIONS: Record<string, StadiumLocation> = {
  // AFC East
  "Buffalo Bills": { name: "Highmark Stadium", city: "Orchard Park", state: "NY", lat: 42.7738, lon: -78.7869 },
  "Miami Dolphins": { name: "Hard Rock Stadium", city: "Miami Gardens", state: "FL", lat: 25.9581, lon: -80.2389 },
  "New England Patriots": { name: "Gillette Stadium", city: "Foxborough", state: "MA", lat: 42.0909, lon: -71.2643 },
  "New York Jets": { name: "MetLife Stadium", city: "East Rutherford", state: "NJ", lat: 40.8135, lon: -74.0745 },
  // AFC North
  "Baltimore Ravens": { name: "M&T Bank Stadium", city: "Baltimore", state: "MD", lat: 39.2780, lon: -76.6227 },
  "Cincinnati Bengals": { name: "Paycor Stadium", city: "Cincinnati", state: "OH", lat: 39.0954, lon: -84.5160 },
  "Cleveland Browns": { name: "FirstEnergy Stadium", city: "Cleveland", state: "OH", lat: 41.5061, lon: -81.6996 },
  "Pittsburgh Steelers": { name: "Acrisure Stadium", city: "Pittsburgh", state: "PA", lat: 40.4468, lon: -80.0157 },
  // AFC South
  "Houston Texans": { name: "NRG Stadium", city: "Houston", state: "TX", lat: 29.6847, lon: -95.4107 },
  "Indianapolis Colts": { name: "Lucas Oil Stadium", city: "Indianapolis", state: "IN", lat: 39.7601, lon: -86.1639 },
  "Jacksonville Jaguars": { name: "EverBank Stadium", city: "Jacksonville", state: "FL", lat: 30.3239, lon: -81.6374 },
  "Tennessee Titans": { name: "Nissan Stadium", city: "Nashville", state: "TN", lat: 36.1665, lon: -86.7713 },
  // AFC West
  "Denver Broncos": { name: "Empower Field", city: "Denver", state: "CO", lat: 39.7439, lon: -105.0200 },
  "Kansas City Chiefs": { name: "GEHA Field", city: "Kansas City", state: "MO", lat: 39.0489, lon: -94.4839 },
  "Las Vegas Raiders": { name: "Allegiant Stadium", city: "Las Vegas", state: "NV", lat: 36.0908, lon: -115.1837 },
  "Los Angeles Chargers": { name: "SoFi Stadium", city: "Inglewood", state: "CA", lat: 33.9533, lon: -118.3387 },
  // NFC East
  "Dallas Cowboys": { name: "AT&T Stadium", city: "Arlington", state: "TX", lat: 32.7473, lon: -97.0945 },
  "New York Giants": { name: "MetLife Stadium", city: "East Rutherford", state: "NJ", lat: 40.8135, lon: -74.0745 },
  "Philadelphia Eagles": { name: "Lincoln Financial Field", city: "Philadelphia", state: "PA", lat: 39.9008, lon: -75.1675 },
  "Washington Commanders": { name: "FedExField", city: "Landover", state: "MD", lat: 38.9077, lon: -76.8644 },
  // NFC North
  "Chicago Bears": { name: "Soldier Field", city: "Chicago", state: "IL", lat: 41.8625, lon: -87.6167 },
  "Detroit Lions": { name: "Ford Field", city: "Detroit", state: "MI", lat: 42.3400, lon: -83.0456 },
  "Green Bay Packers": { name: "Lambeau Field", city: "Green Bay", state: "WI", lat: 44.5013, lon: -88.0622 },
  "Minnesota Vikings": { name: "U.S. Bank Stadium", city: "Minneapolis", state: "MN", lat: 44.9740, lon: -93.2581 },
  // NFC South
  "Atlanta Falcons": { name: "Mercedes-Benz Stadium", city: "Atlanta", state: "GA", lat: 33.7555, lon: -84.4013 },
  "Carolina Panthers": { name: "Bank of America Stadium", city: "Charlotte", state: "NC", lat: 35.2258, lon: -80.8528 },
  "New Orleans Saints": { name: "Caesars Superdome", city: "New Orleans", state: "LA", lat: 29.9511, lon: -90.0815 },
  "Tampa Bay Buccaneers": { name: "Raymond James Stadium", city: "Tampa", state: "FL", lat: 27.9758, lon: -82.5033 },
  // NFC West
  "Arizona Cardinals": { name: "State Farm Stadium", city: "Glendale", state: "AZ", lat: 33.5275, lon: -112.2625 },
  "Los Angeles Rams": { name: "SoFi Stadium", city: "Inglewood", state: "CA", lat: 33.9533, lon: -118.3387 },
  "San Francisco 49ers": { name: "Levi's Stadium", city: "Santa Clara", state: "CA", lat: 37.4030, lon: -121.9694 },
  "Seattle Seahawks": { name: "Lumen Field", city: "Seattle", state: "WA", lat: 47.5952, lon: -122.3316 },
};

/**
 * Team name mapping from ESPN to our standard format
 */
const TEAM_NAME_MAP: Record<string, string> = {
  "BUF": "Buffalo Bills",
  "MIA": "Miami Dolphins",
  "NE": "New England Patriots",
  "NYJ": "New York Jets",
  "BAL": "Baltimore Ravens",
  "CIN": "Cincinnati Bengals",
  "CLE": "Cleveland Browns",
  "PIT": "Pittsburgh Steelers",
  "HOU": "Houston Texans",
  "IND": "Indianapolis Colts",
  "JAX": "Jacksonville Jaguars",
  "TEN": "Tennessee Titans",
  "DEN": "Denver Broncos",
  "KC": "Kansas City Chiefs",
  "LV": "Las Vegas Raiders",
  "LAC": "Los Angeles Chargers",
  "DAL": "Dallas Cowboys",
  "NYG": "New York Giants",
  "PHI": "Philadelphia Eagles",
  "WAS": "Washington Commanders",
  "CHI": "Chicago Bears",
  "DET": "Detroit Lions",
  "GB": "Green Bay Packers",
  "MIN": "Minnesota Vikings",
  "ATL": "Atlanta Falcons",
  "CAR": "Carolina Panthers",
  "NO": "New Orleans Saints",
  "TB": "Tampa Bay Buccaneers",
  "ARI": "Arizona Cardinals",
  "LAR": "Los Angeles Rams",
  "SF": "San Francisco 49ers",
  "SEA": "Seattle Seahawks",
};

/**
 * Fetches upcoming NFL games from ESPN API
 * Falls back to mock data if API is unavailable
 */
export async function getUpcomingGames(weekOffset: number = 0): Promise<NFLGame[]> {
  try {
    // Calculate the target date
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + (7 * weekOffset));
    
    // Get current NFL season year
    const currentYear = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    // NFL season starts in September, so if we're before September, use previous year
    const seasonYear = month < 9 ? currentYear - 1 : currentYear;
    
    // Try to fetch from ESPN API
    // Using ESPN's scoreboard API - query for the entire week range
    // NFL games are typically on Thursday, Saturday, Sunday, and Monday
    // Calculate week start (Thursday) and end (Monday) for NFL week
    
    // Find the Thursday of the current/upcoming week (NFL week starts on Thursday)
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const thursdayDate = new Date(targetDate);
    
    // Calculate days to add/subtract to get to Thursday
    // If today is Thursday (4) or later in the week, use this week's Thursday
    // If today is before Thursday, use next week's Thursday
    if (dayOfWeek < 4) {
      // Before Thursday, go to next Thursday
      thursdayDate.setDate(targetDate.getDate() + (4 - dayOfWeek));
    } else if (dayOfWeek > 4) {
      // After Thursday, go to previous Thursday
      thursdayDate.setDate(targetDate.getDate() - (dayOfWeek - 4));
    }
    // If dayOfWeek === 4, we're already on Thursday
    thursdayDate.setHours(0, 0, 0, 0);
    
    // Monday of the week (4 days after Thursday)
    const mondayDate = new Date(thursdayDate);
    mondayDate.setDate(thursdayDate.getDate() + 4);
    mondayDate.setHours(23, 59, 59, 999); // Include the entire Monday
    
    // Format dates as YYYYMMDD
    const formatDate = (d: Date) => {
      return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    };
    
    // ESPN API: Try multiple approaches to get all games
    // First, try querying without dates to get all upcoming games
    const startDateStr = formatDate(thursdayDate);
    const endDateStr = formatDate(mondayDate);
    
    // Try querying all upcoming games first (no date filter)
    let espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`;
    let allEvents: any[] = [];
    
    try {
      let response = await fetch(espnUrl, {
        headers: {
          'User-Agent': 'WeatherBet-Agent/1.0',
        },
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        allEvents = data.events || [];
        console.log(`ESPN API (no dates) returned ${allEvents.length} events`);
      }
    } catch (e) {
      console.warn("ESPN API query without dates failed:", e);
    }
    
    // Also try with date range
    try {
      espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${startDateStr}-${endDateStr}`;
      const response = await fetch(espnUrl, {
        headers: {
          'User-Agent': 'WeatherBet-Agent/1.0',
        },
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        const rangeEvents = data.events || [];
        console.log(`ESPN API (date range) returned ${rangeEvents.length} events`);
        
        // Merge events, prefer date range results but add any missing from all events
        const rangeEventIds = new Set(rangeEvents.map((e: any) => e.id));
        const additionalEvents = allEvents.filter((e: any) => !rangeEventIds.has(e.id));
        allEvents = [...rangeEvents, ...additionalEvents];
      }
    } catch (e) {
      console.warn("ESPN API query with date range failed:", e);
    }
    
    if (allEvents.length > 0) {
      // Filter events to only include games in our target week range (Thursday through Monday)
      const targetDateStart = new Date(thursdayDate);
      targetDateStart.setHours(0, 0, 0, 0);
      const targetDateEnd = new Date(mondayDate);
      targetDateEnd.setHours(23, 59, 59, 999);
      
      const filteredEvents = allEvents.filter((event: any) => {
        const eventDate = new Date(event.date);
        return eventDate >= targetDateStart && eventDate <= targetDateEnd;
      });
      
      console.log(`Found ${allEvents.length} total events, ${filteredEvents.length} in week range (${startDateStr} to ${endDateStr})`);
      
      // Sort by date to ensure consistent ordering
      filteredEvents.sort((a: any, b: any) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      
      const games: NFLGame[] = [];
      
      for (const event of filteredEvents) {
        const competitions = event.competitions || [];
        for (const competition of competitions) {
          const competitors = competition.competitors || [];
          if (competitors.length >= 2) {
            const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
            const awayTeam = competitors.find((c: any) => c.homeAway === 'away');
            
            if (homeTeam && awayTeam) {
              const homeTeamName = TEAM_NAME_MAP[homeTeam.team.abbreviation] || homeTeam.team.displayName;
              const awayTeamName = TEAM_NAME_MAP[awayTeam.team.abbreviation] || awayTeam.team.displayName;
              
              // Get stadium location
              const stadium = competition.venue?.fullName || "Unknown Stadium";
              const stadiumLocation = getStadiumLocation(homeTeamName) || 
                getStadiumLocation(homeTeam.team.displayName);
              
              if (stadiumLocation) {
                // Parse date and time
                const gameDateTime = new Date(competition.date);
                const dateStr = gameDateTime.toISOString().split('T')[0];
                // Format time in 12-hour format with AM/PM and timezone
                const timeStr = gameDateTime.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true,
                  timeZoneName: 'short',
                });
                
                games.push({
                  id: event.id || competition.id || String(Date.now()),
                  homeTeam: homeTeamName,
                  awayTeam: awayTeamName,
                  date: dateStr,
                  time: timeStr,
                  stadium: stadium,
                  city: stadiumLocation.city,
                  state: stadiumLocation.state,
                  location: {
                    lat: stadiumLocation.lat,
                    lon: stadiumLocation.lon,
                  },
                });
              }
            }
          }
        }
      }
      
      if (games.length > 0) {
        console.log(`Successfully parsed ${games.length} NFL games from ESPN API`);
        return games;
      }
    }
    
    // Fallback: Try alternative API or use mock data
    // Using a public NFL schedule API endpoint
    try {
      const nflApiUrl = `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4391&s=${seasonYear}`;
      const response = await fetch(nflApiUrl);
      
      if (response.ok) {
        const data = await response.json() as any;
        const events = data.events || [];
        
        // Filter for upcoming games
        const upcomingEvents = events
          .filter((e: any) => new Date(e.dateEvent) >= targetDate)
          .slice(0, 10); // Limit to next 10 games
        
        const games: NFLGame[] = [];
        
        for (const event of upcomingEvents) {
          const homeTeam = event.strHomeTeam || "";
          const awayTeam = event.strAwayTeam || "";
          const stadiumLocation = getStadiumLocation(homeTeam);
          
          if (stadiumLocation) {
            games.push({
              id: event.idEvent || String(Date.now() + Math.random()),
              homeTeam: homeTeam,
              awayTeam: awayTeam,
              date: event.dateEvent,
              time: event.strTime || "12:00",
              stadium: event.strVenue || stadiumLocation.name,
              city: stadiumLocation.city,
              state: stadiumLocation.state,
              location: {
                lat: stadiumLocation.lat,
                lon: stadiumLocation.lon,
              },
            });
          }
        }
        
        if (games.length > 0) {
          return games;
        }
      }
    } catch (altApiError) {
      console.warn("Alternative API request failed, using mock data:", altApiError);
    }
  } catch (error) {
    console.error("Error fetching NFL games:", error);
  }
  
  // Fallback to mock data if all APIs fail
  return getMockGames(weekOffset);
}

/**
 * Generates mock games as fallback
 */
function getMockGames(weekOffset: number): NFLGame[] {
  const now = new Date();
  const gameDate = new Date(now);
  gameDate.setDate(now.getDate() + (7 * weekOffset) + 1); // Next Sunday
  
  const mockGames: NFLGame[] = [
    {
      id: "1",
      homeTeam: "Kansas City Chiefs",
      awayTeam: "Buffalo Bills",
      date: gameDate.toISOString().split('T')[0],
      time: "13:00",
      stadium: "GEHA Field",
      city: "Kansas City",
      state: "MO",
      location: {
        lat: 39.0489,
        lon: -94.4839,
      },
    },
    {
      id: "2",
      homeTeam: "Green Bay Packers",
      awayTeam: "Chicago Bears",
      date: gameDate.toISOString().split('T')[0],
      time: "16:25",
      stadium: "Lambeau Field",
      city: "Green Bay",
      state: "WI",
      location: {
        lat: 44.5013,
        lon: -88.0622,
      },
    },
  ];

  return mockGames;
}

/**
 * Gets stadium location for a team
 */
export function getStadiumLocation(teamName: string): StadiumLocation | null {
  return STADIUM_LOCATIONS[teamName] || null;
}

/**
 * Formats game information for display
 */
export function formatGameInfo(game: NFLGame): string {
  return `${game.awayTeam} @ ${game.homeTeam}\n` +
    `Date: ${game.date} ${game.time}\n` +
    `Location: ${game.stadium}, ${game.city}, ${game.state}`;
}
