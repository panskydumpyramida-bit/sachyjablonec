
const { Chess } = require('chess.js');
// text from user
const pgn = `[Event "KPD SSLK, Novy Bor B - Bizuterie Jbc A"]
[Site "?"]
[Date "2025.03.23"]
[Round "9.1"]
[White "Hofman, Krystof"]
[Black "Duda, Antonin"]
[Result "1-0"]
[WhiteElo "2055"]
[BlackElo "2092"]
[ECO "A08"]
[Link "https://www.chess.com/analysis/collection/moje-acka-mJ1sD5Ci/23NBHm4KQS/games"]

1. Nf3 d5 2. g3 Nf6 3. Bg2 c5 4. O-O h6 $5 {Vyčkávací tah. Brání 4.d4} 5. d3 (5.
d4 $6 cxd4 6. Nxd4 e5 $15 {bílý nemůže dobrat koně na c6, protože tam ještě není a
černý má pohodlný náskok v centru.}) 5... Nc6 6. Nbd2 e5 7. e4 d4 8. Nc4 Qc7 9.
a4 Be7 10. Nh4 Na5 11. b3 Nxc4 12. bxc4 Nd7 13. Nf5 Bf8 14. f4 g6 15. Nh4 Bg7
16. Nf3 O-O 17. h4 a5 18. f5 Nf6 19. Nh2 gxf5 20. exf5 e4 21. Bf4 Qe7 22. g4 e3
23. Qf3 Nh7 24. Qg3 Ra6 25. Be4 Nf6 26. Bf3 Nh7 27. Rab1 Kh8 28. Kh1 Rg8 29. g5
hxg5 30. hxg5 Bh6 31. Be5+ f6 32. gxf6 Nxf6 33. Ng4 Rg7 34. Qh4 Rh7 35. Nxf6
Rxf6 36. Bxf6+ Qxf6 37. Qxf6+ Bg7+ 38. Kg2 Bxf6 39. Rh1 Bh4 40. Kf1 Bxf5 41.
Rxb7 Rh6 42. Rc7 Kg8 43. Rxc5 Bd7 44. Rxa5 Rf6 45. Ke2 Rxf3 46. Kxf3 Bc6+ 47.
Rd5 1-0`;

const chess = new Chess();
chess.load_pgn(pgn);

console.log("Comments:", chess.get_comments ? chess.get_comments() : "get_comments() not found");
console.log("HistoryVerbose:", JSON.stringify(chess.history({ verbose: true }).slice(0, 10), null, 2));

// Check if variations are preserved? standard chess.js usually strips them.
// Let's see if we can access them.
