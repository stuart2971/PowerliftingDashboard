const BASE = '';

function getToken() {
  return localStorage.getItem('token');
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.hash = '#/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Auth
export const authAPI = {
  login:    (body) => apiFetch('/api/auth/login',    { method: 'POST', body }),
  register: (body) => apiFetch('/api/auth/register', { method: 'POST', body }),
  me:       ()     => apiFetch('/api/auth/me')
};

// Athletes
export const athleteAPI = {
  list:    ()           => apiFetch('/api/athletes'),
  get:     (id)         => apiFetch(`/api/athletes/${id}`),
  create:  (body)       => apiFetch('/api/athletes', { method: 'POST', body }),
  update:  (id, body)   => apiFetch(`/api/athletes/${id}`, { method: 'PUT', body }),
  pbs:     (id)         => apiFetch(`/api/athletes/${id}/pbs`),
  addPb:   (id, body)   => apiFetch(`/api/athletes/${id}/pbs`, { method: 'POST', body }),
  deletePb:     (id, pbId)   => apiFetch(`/api/athletes/${id}/pbs/${pbId}`, { method: 'DELETE' }),
  exerciseData: (id, type)   => apiFetch(`/api/athletes/${id}/exercise-data?type=${encodeURIComponent(type)}`)
};

// Programs
export const programAPI = {
  list:          ()              => apiFetch('/api/programs'),
  get:           (id)            => apiFetch(`/api/programs/${id}`),
  getFull:       (id)            => apiFetch(`/api/programs/${id}/full`),
  create:        (body)          => apiFetch('/api/programs', { method: 'POST', body }),
  update:        (id, body)      => apiFetch(`/api/programs/${id}`, { method: 'PUT', body }),
  delete:        (id)            => apiFetch(`/api/programs/${id}`, { method: 'DELETE' }),
  assign:        (id, athlId)    => apiFetch(`/api/programs/${id}/assign/${athlId}`, { method: 'POST' }),
  copyWeek:      (id, weekId, exerciseIncrements) => apiFetch(`/api/programs/${id}/copy-week/${weekId}`, { method: 'POST', body: { exercise_increments: exerciseIncrements } }),
  // Weeks
  getWeeks:      (id)            => apiFetch(`/api/programs/${id}/weeks`),
  addWeek:       (id, body)      => apiFetch(`/api/programs/${id}/weeks`, { method: 'POST', body }),
  deleteWeek:    (weekId)        => apiFetch(`/api/programs/weeks/${weekId}`, { method: 'DELETE' }),
  // Days
  getDays:       (weekId)        => apiFetch(`/api/programs/weeks/${weekId}/days`),
  addDay:        (weekId, body)  => apiFetch(`/api/programs/weeks/${weekId}/days`, { method: 'POST', body }),
  deleteDay:     (dayId)         => apiFetch(`/api/programs/days/${dayId}`, { method: 'DELETE' }),
  // Exercises
  getExercises:  (dayId)         => apiFetch(`/api/programs/days/${dayId}/exercises`),
  addExercise:   (dayId, body)   => apiFetch(`/api/programs/days/${dayId}/exercises`, { method: 'POST', body }),
  updateExercise:(exId, body)    => apiFetch(`/api/programs/exercises/${exId}`, { method: 'PUT', body }),
  deleteExercise:(exId)          => apiFetch(`/api/programs/exercises/${exId}`, { method: 'DELETE' }),
  // Sets
  getSets:       (exId)          => apiFetch(`/api/programs/exercises/${exId}/sets`),
  addSet:        (exId, body)    => apiFetch(`/api/programs/exercises/${exId}/sets`, { method: 'POST', body }),
  updateSet:     (setId, body)   => apiFetch(`/api/programs/sets/${setId}`, { method: 'PUT', body }),
  deleteSet:     (setId)         => apiFetch(`/api/programs/sets/${setId}`, { method: 'DELETE' })
};

// Sessions
export const sessionAPI = {
  list:         (params = '')    => apiFetch(`/api/sessions${params}`),
  get:          (id)             => apiFetch(`/api/sessions/${id}`),
  create:       (body)           => apiFetch('/api/sessions', { method: 'POST', body }),
  update:       (id, body)       => apiFetch(`/api/sessions/${id}`, { method: 'PUT', body }),
  addExercise:  (id, body)       => apiFetch(`/api/sessions/${id}/exercises`, { method: 'POST', body }),
  logSet:       (exId, body)     => apiFetch(`/api/sessions/exercises/${exId}/sets`, { method: 'POST', body }),
  updateSet:    (setId, body)    => apiFetch(`/api/sessions/sets/${setId}`, { method: 'PUT', body }),
  coachNote:    (setId, body)    => apiFetch(`/api/sessions/sets/${setId}/coach-notes`, { method: 'PUT', body }),
  lastLoad:     (exerciseName)   => apiFetch(`/api/sessions/last-load?exerciseName=${encodeURIComponent(exerciseName)}`),
  unlogSet:     (setId)          => apiFetch(`/api/sessions/sets/${setId}/unlog`, { method: 'POST' }),
  exerciseHistory: (exerciseName) => apiFetch(`/api/sessions/exercise-history?exerciseName=${encodeURIComponent(exerciseName)}`),
  avgDuration:     (dayOfWeek)    => apiFetch(`/api/sessions/avg-duration?dayOfWeek=${dayOfWeek}`)
};
