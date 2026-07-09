# No formal FSM library

Hand and room flow use phase strings (`idle | waiting | playing | settling`) and explicit guards in `roomTable` handlers. Rules live in pure domain modules.

A full FSM framework would add ceremony without payoff at 3 rooms × 4 players. Socket.IO remains a thin adapter, not the state machine.
