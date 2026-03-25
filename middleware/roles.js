function requireCoach(req, res, next) {
  if (req.user?.role !== 'coach') {
    return res.status(403).json({ error: 'Coach access required' });
  }
  next();
}

function requireAthlete(req, res, next) {
  if (req.user?.role !== 'athlete') {
    return res.status(403).json({ error: 'Athlete access required' });
  }
  next();
}

// Athlete can only access their own data; coach can access any
function requireSelfOrCoach(getAthleteId) {
  return (req, res, next) => {
    const athleteId = getAthleteId(req);
    if (req.user.role === 'coach') return next();
    if (String(req.user.athleteProfileId) === String(athleteId)) return next();
    res.status(403).json({ error: 'Access denied' });
  };
}

module.exports = { requireCoach, requireAthlete, requireSelfOrCoach };
