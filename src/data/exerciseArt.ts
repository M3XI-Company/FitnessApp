/** Written by scripts/add-exercise-art.py: the poster-style figure for each exercise, by build. Do not edit by hand. */
export const EXERCISE_ART: Record<string, { male?: number; female?: number }> = {
  'bench': { female: require('../../assets/exercise/bench_female.jpg'), male: require('../../assets/exercise/bench_male.jpg') },
  'cable-fly': { female: require('../../assets/exercise/cable_fly_female.jpg'), male: require('../../assets/exercise/cable_fly_male.jpg') },
  'deadlift': { male: require('../../assets/exercise/deadlift_male.jpg') },
  'dips': { female: require('../../assets/exercise/dips_female.jpg'), male: require('../../assets/exercise/dips_male.jpg') },
  'incline-db': { female: require('../../assets/exercise/incline_db_female.jpg'), male: require('../../assets/exercise/incline_db_male.jpg') },
  'pullup': { female: require('../../assets/exercise/pullup_female.jpg'), male: require('../../assets/exercise/pullup_male.jpg') },
  'pushup': { female: require('../../assets/exercise/pushup_female.jpg'), male: require('../../assets/exercise/pushup_male.jpg') },
  'squat': { female: require('../../assets/exercise/squat_female.jpg'), male: require('../../assets/exercise/squat_male.jpg') },
}
