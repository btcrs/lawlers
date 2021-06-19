const axios = require("axios");
const chartistSvg = require("svg-chartist");
const fs = require("fs");

const HTTPClient = axios.create({
  baseURL: "http://data.nba.com",
});

winnerReachedFirst = {}
loserReachedFirst = {}

const getPlayByPlay = ({id, date}) => 
  // Get play by play data based on a single game
  HTTPClient({
    method: "GET",
    url: `data/5s/json/cms/noseason/game/${date.replace(/-/g, "")}/${id}/pbp_all.json`
  }).then((response) => response.data.sports_content.game.play);


const getGames = ({ year }) =>
  // Get a list of all games played in a single season
  HTTPClient({
    method: "GET",
    url: `data/10s/v2015/json/mobile_teams/nba/${year}/league/00_full_schedule.json`,
  }).then((response) => {
   let monthsGames = response.data.lscd
   let seasonsGames = monthsGames.reduce((games, month) => {
       return games.concat(month.mscd.g);
    }, []).filter( game => game.stt === "Final" ).map(game => {
     return ({id: game.gid, date: game.gdte, visitor: game.v, home: game.h})
    })
    return(seasonsGames)
  }
  );

const accumulateStats = (playByPlay, gameMeta) => {
 // look through the play by play of each game checking to see if the visitor of home team reached any given score first
 let winner = parseInt(gameMeta.home.s) > parseInt(gameMeta.visitor.s) ? "home" : "visitor"
 let homeScore = 0
 let visitorScore = 0
 let highestReached = 0
 for (const play of playByPlay) {
   let newHomeScore = parseInt(play.home_score)
   let newVisitorScore = parseInt(play.visitor_score)
   if(newHomeScore > homeScore && newHomeScore > newVisitorScore) {
     for (let score = highestReached+1; score <= newHomeScore; score++) {
       if(winner === "home") winnerReachedFirst[score] = (winnerReachedFirst[score]+1) || 1 ;
       if(winner === "visitor") loserReachedFirst[score] = (loserReachedFirst[score]+1) || 1 ;
     }
     highestReached = newHomeScore
   } else if(newVisitorScore > visitorScore && newVisitorScore > newHomeScore) {
     for (let score = highestReached+1; score<= newVisitorScore; score++) {
       if(winner === "visitor") winnerReachedFirst[score] = winnerReachedFirst[score] + 1 || 1;
       if(winner === "home") loserReachedFirst[score] = loserReachedFirst[score] + 1 || 1;
     }
     highestReached = newVisitorScore
   }
   visitorScore = newVisitorScore 
   homeScore = newHomeScore 
 }
}

const makeChart = (percentages, name) => {
  const data = {
    labels: Object.keys(percentages),
    series: [
      Object.values(percentages).map(percentage => percentage.outcomes-(percentage.odds*percentage.outcomes)),
      Object.values(percentages).map(percentage => percentage.odds*percentage.outcomes),
    ],
  };

  const options = {
    reverseData: true,
    stackBars: true,
    horizontalBars: true,
    height: 1750
  };

  const opts = {
    css: `
    .ct-series-a .ct-bar, .ct-series-a .ct-line, .ct-series-a .ct-point, .ct-series-a .ct-slice-donut{
      stroke: #d4e09b
    }
    .ct-series-b .ct-bar, .ct-series-b .ct-line, .ct-series-b .ct-point, .ct-series-b .ct-slice-donut{
      stroke: #f19c79
    }
    .ct-label {
      font-size: 8px;
    }
    `,
    options: options,
  };

  chartistSvg("bar", data, opts).then((html) => {
    fs.writeFileSync(`./charts/${name}.html`, html);
  });
}

const getMaxScore = (winners) => {
    var max = 0;
    for (var property in winners) {
      max = max < parseFloat(property) ? parseFloat(property) : max;
    }
    return max
  }

const getMaxScore = (winners) => {
    var max = 0;
    for (var property in winners) {
      max = max < parseFloat(property) ? parseFloat(property) : max;
    }
    return max
  }

const calculatePercentages = (winners, losers, max) => {
    percentages = {}
    for (let index = 1; index <= max; index++) {
      if(!losers[index]){
        percentages[index] = {odds: 1, outcomes: winners[index]}
      } else{
        percentages[index] = {odds: winners[index]/(winners[index]+losers[index]), outcomes: winners[index] + losers[index]}
      }
    }
    return percentages
}

async function generateStats(year) {
  try {
    const seasonsGames = await getGames({ year: year});
    for (const game of seasonsGames) {
      let playByPlay = await getPlayByPlay(game)
      accumulateStats(playByPlay, game)
    }
    let max = getMaxScore(winnerReachedFirst)
    let percentages = calculatePercentages(winnerReachedFirst, loserReachedFirst, max)
    makeChart(percentages, year)
  } catch (error) {
    console.log(error)
  }
}

generateStats(2020)