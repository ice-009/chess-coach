# How ChessCoach teaches: the research behind it

This is the evidence the app's study system is built on, written for the player and for whoever changes the app
next. Each section says what the research found, how strong the evidence is, and what ChessCoach does with it.
Where a finding comes from outside chess (most learning science does), that's said too.

## 1. What makes chess players better

- **Serious study alone is the strongest predictor of skill.** In two large samples of tournament players, time spent
  on *serious study alone* (solving, analysing, studying games on your own) predicted rating better than tournament
  play or lessons; grandmasters had put in about 5,000 hours of it in their first ten years, about five times more
  than intermediate players. Chess activities together explained about 40% of the differences in rating.
  ([Charness, Tuffiash, Krampe, Reingold & Vasyukova, 2005, *Applied Cognitive Psychology* 19](https://scinapse.io/papers/2134432271))
- **Practice matters a lot, but it isn't everything.** Across six chess studies (more than 1,000 players) deliberate
  practice explained about 34% of the variance in skill ([Hambrick et al., 2014, *Intelligence*](https://www.Gwern.net/doc/psychology/chess/2014-hambrick.pdf));
  a meta-analysis put it at 26% for games in general ([Macnamara, Hambrick & Oswald, 2014](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4101876/)).
  So: train deliberately, and don't expect hours alone to do it.
- **Experts recognise patterns.** Masters remember real positions far better than novices but random positions no
  better, because they store "chunks" of pieces ([Chase & Simon, 1973](https://lichess.org/@/RuyLopez1000/blog/the-science-of-chess-patterns/tBIkhxXt)),
  organised into larger "templates" ([Gobet & Simon, 1996](https://www.Gwern.net/doc/psychology/chess/1996-gobet.pdf)).
  Patterns come from seeing many varied, meaningful positions: tactics and real games.
- **Thinking longer helps, at every level.** Given more time, both experts and weaker players chose objectively better
  moves, on easy and hard problems alike ([Moxley, Ericsson, Charness & Krampe, 2012, *Cognition* 124](https://dc2.philarchive.org/rec/MOXTRO)).
  Faster time limits clearly lower the quality of play, even for grandmasters
  ([Chabris & Hearst, 2003, *Cognitive Science* 27](https://bura.brunel.ac.uk/handle/2438/1391)).
- **The first idea blinds you to better ones (Einstellung).** Eye-tracking shows that once experts see a familiar
  solution, their eyes keep returning to it and they miss a better one, even while believing they're looking for
  alternatives ([Bilalić, McLeod & Gobet, 2008](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3790829/)).

**In ChessCoach:** the daily plan is built around study you do alone (puzzles, the "Is it safe?" drill, reviewing your
own games); the clock coach pushes you to use your time; Quick Review and the drills ask you to look for checks,
captures and threats *before* deciding; "find a better move" exercises train you past the first idea.

## 2. How to make learning stick

- **Testing beats rereading.** Students who practised recalling a text remembered 61% of it a week later, against 40%
  for those who reread it; rereading only wins on a test five minutes later
  ([Roediger & Karpicke, 2006, *Psychological Science*](https://psychology.ecu.edu/wp-content/pv-uploads/sites/216/2019/03/Roediger-Karpicke-2006.pdf)).
- **Trying before you know the answer helps, even when you get it wrong.** An unsuccessful attempt followed by the
  answer is remembered better than just studying the answer
  ([Kornell, Hays & Bjork, 2009](https://pubmed.ncbi.nlm.nih.gov/19586265/)).
- **Spacing.** Reviews spread over time beat cramming; the best gap grows with how long you want to remember
  (about 20–40% of a one-week horizon, 5–10% of a one-year horizon)
  ([Cepeda, Vul, Rohrer, Wixted & Pashler, 2008, *Psychological Science* 19](https://www.evullab.org/pdf/CepedaVulRohrerWixtedPashler-PS-2008.pdf)).
- **Interleaving.** Mixing problem types beats practising one type at a time, on average (Hedges' g = 0.42 over 59
  studies), most for visual categories and problem solving ([Brunmair & Richter, 2019, *Psychological Bulletin*](https://www.psychologie.uni-wuerzburg.de/fileadmin/06020400/2019/Brunmair_Richter_in_press__2019_META-ANALYSIS_OF_INTERLEAVED_LEARNING.pdf)).
- **Desirable difficulties.** Spacing, interleaving, varied practice and testing all *feel* slower and harder, and lead
  to better long-term retention and transfer ([E. Bjork & R. Bjork, 2011](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf)).
- **Self-explanation.** Learners who explain *why* a step works (linking it to principles) learn much more from
  examples than those who just read them ([Chi et al., 1989; Renkl](https://en.wikipedia.org/wiki/Worked-example_effect));
  prompting people to self-explain has a small to moderate benefit.
- **Confident mistakes are the ones you fix.** Errors made with high confidence are *more* likely to be corrected after
  feedback, because the surprise focuses attention ([Butterfield & Metcalfe, 2001](https://pmc.ncbi.nlm.nih.gov/articles/PMC4084803)).

**In ChessCoach:** every learning step is a question first and an explanation second (find the move, safe or not,
guess the master's move); everything you miss goes into one review deck scheduled by FSRS (below) and comes back
mixed with other kinds of positions; Quick Review asks you what went wrong before telling you; the "Is it safe?"
drill asks how sure you are and brings confident mistakes back sooner.

## 3. Scheduling reviews: FSRS

ChessCoach schedules reviews with **FSRS** (Free Spaced Repetition Scheduler), the open algorithm by Jarrett Ye that
Anki adopted in 2023–24. It models each memory with three numbers
([algorithm description](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm),
[a 100-line implementation](https://borretti.me/article/implementing-fsrs-in-100-lines)):

- **Retrievability R**: the chance you'd get it right now. It decays as R(t, S) = (1 + factor·t/S)^(−w₂₀), where
  factor = 0.9^(−1/w₂₀) − 1 makes R = 90% exactly when t = S.
- **Stability S**: days until R falls to 90%. It grows after each success, more when the item is easy, when S is still
  small, and when you nearly forgot it (lower R): S′ = S·(e^w₈·(11 − D)·S^(−w₉)·(e^(w₁₀(1−R)) − 1)·(w₁₅ if Hard)·(w₁₆ if Easy) + 1).
  After a lapse it drops: S′ = min(S, w₁₁·D^(−w₁₂)·((S + 1)^w₁₃ − 1)·e^(w₁₄(1−R))).
- **Difficulty D** (1–10): starts at D₀(G) = w₄ − e^(w₅(G−1)) + 1, moves with each grade (linear damping
  ΔD = −w₆(G − 3), scaled by (10 − D)/9) and reverts slightly toward D₀(Easy).

The next review is scheduled when R would fall to the desired retention (90%): t = S/factor·(0.9^(−1/w₂₀) − 1),
which equals S. ChessCoach uses the published FSRS-6 default parameters and grades each review automatically:
wrong = Again, right after a hint or a second try = Hard, right first time = Good, right first time quickly and
confidently = Easy.

## 4. What the app does not claim

- Brain-training transfer: chess skill doesn't make you smarter in general, and the app doesn't promise that.
- Rating guarantees: the research explains *differences between players*; how fast one person improves varies a lot.
  For a player around 700 rapid, most points come from fewer blunders, which is what the daily plan targets.
- Tilt: research on top players' games finds that recent small inaccuracies are followed by less accurate play, while
  blunders tend to make players more careful; individual players' streaks are often just chance
  ([a Lichess analysis](https://lichess.org/@/NDpatzer/blog/being-on-tilt/SdGi4xjg)). The app's break suggestion is a
  gentle nudge based on your own results, not a diagnosis.
- Human-like opponents: engines trained on human games (Maia) predict human moves far better than Stockfish
  ([McIlroy-Young, Sen, Kleinberg & Anderson, KDD 2020](https://ar5iv.arxiv.org/html/2006.01855)). ChessCoach's computer
  opponent weakens Stockfish instead, because Maia's networks don't yet run well in a phone browser.
