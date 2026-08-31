// Exercise form guides from the Free Exercise DB (github.com/yuhonas/free-exercise-db),
// a public-domain dataset. Images are hotlinked from that repository.

export interface FormGuide {
  source: string;
  images: string[];
  steps: string[];
}

export const FORM_IMG_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export const FORM_GUIDES: Record<string, FormGuide> = {
  'goblet-squat': {
    source: 'Goblet Squat',
    images: ['Goblet_Squat/0.jpg', 'Goblet_Squat/1.jpg'],
    steps: [
      'Stand holding a light kettlebell by the horns close to your chest. This will be your starting position.',
      'Squat down between your legs until your hamstrings are on your calves. Keep your chest and head up and your back straight.',
      'At the bottom position, pause and use your elbows to push your knees out. Return to the starting position, and repeat for 10-20 repetitions.',
    ],
  },
  'db-bench': {
    source: 'Dumbbell Bench Press',
    images: ['Dumbbell_Bench_Press/0.jpg', 'Dumbbell_Bench_Press/1.jpg'],
    steps: [
      'Lie down on a flat bench with a dumbbell in each hand resting on top of your thighs. The palms of your hands will be facing each other.',
      'Then, using your thighs to help raise the dumbbells up, lift the dumbbells one at a time so that you can hold them in front of you at shoulder width.',
      'Once at shoulder width, rotate your wrists forward so that the palms of your hands are facing away from you. The dumbbells should be just to the sides of your chest, with your upper arm and forearm creating a 90 degree angle. Be sure to maintain full control of the dumbbells at all times. This will be your starting position.',
      'Then, as you breathe out, use your chest to push the dumbbells up. Lock your arms at the top of the lift and squeeze your chest, hold for a second and then begin coming down slowly. Tip: Ideally, lowering the weight should take about twice as long as raising it.',
      'Repeat the movement for the prescribed amount of repetitions of your training program.',
    ],
  },
  'db-row': {
    source: 'Dumbbell Incline Row',
    images: ['Dumbbell_Incline_Row/0.jpg', 'Dumbbell_Incline_Row/1.jpg'],
    steps: [
      'Using a neutral grip, lean into an incline bench.',
      'Take a dumbbell in each hand with a neutral grip, beginning with the arms straight. This will be your starting position.',
      'Retract the shoulder blades and flex the elbows to row the dumbbells to your side.',
      'Pause at the top of the motion, and then return to the starting position.',
    ],
  },
  'db-rdl': {
    source: 'Stiff-Legged Dumbbell Deadlift',
    images: ['Stiff-Legged_Dumbbell_Deadlift/0.jpg', 'Stiff-Legged_Dumbbell_Deadlift/1.jpg'],
    steps: [
      "Grasp a couple of dumbbells holding them by your side at arm's length.",
      'Stand with your torso straight and your legs spaced using a shoulder width or narrower stance. The knees should be slightly bent. This is your starting position.',
      'Keeping the knees stationary, lower the dumbbells to over the top of your feet by bending at the waist while keeping your back straight. Keep moving forward as if you were going to pick something from the floor until you feel a stretch on the hamstrings. Exhale as you perform this movement',
      'Start bringing your torso up straight again by extending your hips and waist until you are back at the starting position. Inhale as you perform this movement.',
      'Repeat for the recommended amount of repetitions.',
    ],
  },
  'lateral-raise': {
    source: 'Side Lateral Raise',
    images: ['Side_Lateral_Raise/0.jpg', 'Side_Lateral_Raise/1.jpg'],
    steps: [
      'Pick a couple of dumbbells and stand with a straight torso and the dumbbells by your side at arms length with the palms of the hand facing you. This will be your starting position.',
      'While maintaining the torso in a stationary position (no swinging), lift the dumbbells to your side with a slight bend on the elbow and the hands slightly tilted forward as if pouring water in a glass. Continue to go up until you arms are parallel to the floor. Exhale as you execute this movement and pause for a second at the top.',
      'Lower the dumbbells back down slowly to the starting position as you inhale.',
      'Repeat for the recommended amount of repetitions.',
    ],
  },
  'cable-crunch': {
    source: 'Cable Crunch',
    images: ['Cable_Crunch/0.jpg', 'Cable_Crunch/1.jpg'],
    steps: [
      'Kneel below a high pulley that contains a rope attachment.',
      'Grasp cable rope attachment and lower the rope until your hands are placed next to your face.',
      'Flex your hips slightly and allow the weight to hyperextend the lower back. This will be your starting position.',
      'With the hips stationary, flex the waist as you contract the abs so that the elbows travel towards the middle of the thighs. Exhale as you perform this portion of the movement and hold the contraction for a second.',
      'Slowly return to the starting position as you inhale. Tip: Make sure that you keep constant tension on the abs throughout the movement. Also, do not choose a weight so heavy that the lower back handles the brunt of the work.',
      'Repeat for the recommended amount of repetitions.',
    ],
  },
  'reverse-lunge': {
    source: 'Dumbbell Rear Lunge',
    images: ['Dumbbell_Rear_Lunge/0.jpg', 'Dumbbell_Rear_Lunge/1.jpg'],
    steps: [
      'Stand with your torso upright holding two dumbbells in your hands by your sides. This will be your starting position.',
      'Step backward with your right leg around two feet or so from the left foot and lower your upper body down, while keeping the torso upright and maintaining balance. Inhale as you go down. Tip: As in the other exercises, do not allow your knee to go forward beyond your toes as you come down, as this will put undue stress on the knee joint. Make sure that you keep your front shin perpendicular to the ground. Keep the torso upright during the lunge; flexible hip flexors are important. A long lunge emphasizes the Gluteus Maximus; a short lunge emphasizes Quadriceps.',
      'Push up and go back to the starting position as you exhale. Tip: Use the ball of your feet to push in order to accentuate the quadriceps. To focus on the glutes, press with your heels.',
      'Now repeat with the opposite leg.',
    ],
  },
  'db-shoulder-press': {
    source: 'Dumbbell Shoulder Press',
    images: ['Dumbbell_Shoulder_Press/0.jpg', 'Dumbbell_Shoulder_Press/1.jpg'],
    steps: [
      'While holding a dumbbell in each hand, sit on a military press bench or utility bench that has back support. Place the dumbbells upright on top of your thighs.',
      'Now raise the dumbbells to shoulder height one at a time using your thighs to help propel them up into position.',
      'Make sure to rotate your wrists so that the palms of your hands are facing forward. This is your starting position.',
      'Now, exhale and push the dumbbells upward until they touch at the top.',
      'Then, after a brief pause at the top contracted position, slowly lower the weights back down to the starting position while inhaling.',
      'Repeat for the recommended amount of repetitions.',
    ],
  },
  'sa-lat-pulldown': {
    source: 'One Arm Lat Pulldown',
    images: ['One_Arm_Lat_Pulldown/0.jpg', 'One_Arm_Lat_Pulldown/1.jpg'],
    steps: [
      'Select an appropriate weight and adjust the knee pad to help keep you down. Grasp the handle with a pronated grip. This will be your starting position.',
      'Pull the handle down, squeezing your elbow to your side as you flex the elbow.',
      'Pause at the bottom of the motion, and then slowly return the handle to the starting position.',
      'For multiple repetitions, avoid completely returning the weight to keep tension on the muscles being worked.',
    ],
  },
  'cable-pull-through': {
    source: 'Pull Through',
    images: ['Pull_Through/0.jpg', 'Pull_Through/1.jpg'],
    steps: [
      'Begin standing a few feet in front of a low pulley with a rope or handle attached. Face away from the machine, straddling the cable, with your feet set wide apart.',
      'Begin the movement by reaching through your legs as far as possible, bending at the hips. Keep your knees slightly bent. Keeping your arms straight, extend through the hip to stand straight up. Avoid pulling upward through the shoulders; all of the motion should originate through the hips.',
    ],
  },
  'face-pull': {
    source: 'Face Pull',
    images: ['Face_Pull/0.jpg', 'Face_Pull/1.jpg'],
    steps: [
      'Facing a high pulley with a rope or dual handles attached, pull the weight directly towards your face, separating your hands as you do so. Keep your upper arms parallel to the ground.',
    ],
  },
  'db-curl': {
    source: 'Dumbbell Bicep Curl',
    images: ['Dumbbell_Bicep_Curl/0.jpg', 'Dumbbell_Bicep_Curl/1.jpg'],
    steps: [
      "Stand up straight with a dumbbell in each hand at arm's length. Keep your elbows close to your torso and rotate the palms of your hands until they are facing forward. This will be your starting position.",
      'Now, keeping the upper arms stationary, exhale and curl the weights while contracting your biceps. Continue to raise the weights until your biceps are fully contracted and the dumbbells are at shoulder level. Hold the contracted position for a brief pause as you squeeze your biceps.',
      'Then, inhale and slowly begin to lower the dumbbells back to the starting position.',
      'Repeat for the recommended amount of repetitions.',
    ],
  },
  'tricep-pushdown': {
    source: 'Triceps Pushdown',
    images: ['Triceps_Pushdown/0.jpg', 'Triceps_Pushdown/1.jpg'],
    steps: [
      'Attach a straight or angled bar to a high pulley and grab with an overhand grip (palms facing down) at shoulder width.',
      'Standing upright with the torso straight and a very small inclination forward, bring the upper arms close to your body and perpendicular to the floor. The forearms should be pointing up towards the pulley as they hold the bar. This is your starting position.',
      'Using the triceps, bring the bar down until it touches the front of your thighs and the arms are fully extended perpendicular to the floor. The upper arms should always remain stationary next to your torso and only the forearms should move. Exhale as you perform this movement.',
      'After a second hold at the contracted position, bring the bar slowly up to the starting point. Breathe in as you perform this step.',
      'Repeat for the recommended amount of repetitions.',
    ],
  },
};
