/* Short, fictional English training notes. The model sees no patient IDs or chart labels. */
(function (root) {
  "use strict";
  const training = {
    independent: [
      "I dressed myself without help.", "I got dressed on my own.",
      "I put on my clothes by myself.", "I managed all my clothing independently.",
      "I needed no help getting dressed.", "I needed no reminders or help.",
      "I buttoned my blouse without assistance.", "I needed nobody to help me dress.",
      "I got dressed without anyone reminding me.", "I did every button myself.",
      "I managed my socks myself.", "I fastened my jacket on my own.",
      "I got myself ready without a reminder.", "Nobody helped me put on my clothes.",
      "I put everything on myself.", "I dressed without needing any support.",
      "I didn't need a reminder or any help with my clothes.", "I put on my shirt with no assistance.",
    ],
    prompting: [
      "My partner reminded me to get dressed.", "I needed a reminder to start dressing.",
      "Dad gave me a verbal cue to get started.", "I got dressed after a reminder.",
      "Someone had to prompt me to put on my clothes.", "I needed prompting to dress.",
      "My wife told me it was time to get dressed.", "My sister reminded me about my shirt.",
      "I started after he reminded me.", "A verbal reminder was enough.",
      "I did it myself after she prompted me.", "I just needed a nudge to start dressing.",
      "Once he told me to start I dressed myself.", "She had to remind me to change.",
      "I needed a spoken prompt before I could begin.", "After a cue I put my clothes on myself.",
      "My carer reminded me, then I finished dressing on my own.", "I started when my brother gave a reminder.",
    ],
    hands_on: [
      "My wife pulled my sleeve over my arm.", "My brother physically helped me get dressed.",
      "My partner helped me button my shirt.", "My daughter pulled my jumper over my head.",
      "Someone put my socks on for me.", "He helped me into my trousers.",
      "She zipped my jacket for me.", "My husband did up the buttons for me.",
      "My sister fastened my shirt buttons.", "Dad lifted my arm into the sleeve.",
      "I needed physical help with my clothes.", "My son tied my shoelaces for me.",
      "She helped me pull on my socks.", "I could not dress without her help.",
      "I asked him to do up my buttons and he did.", "My carer pulled up my zipper.",
      "My mum helped fasten my coat.", "She helped me fasten my jacket.",
    ],
    unclear: [
      "I was already dressed before breakfast.", "I chose a shirt from the wardrobe.",
      "My sister visited this morning.", "I wore the green jumper today.",
      "We talked about getting dressed.", "I cannot remember who helped.",
      "I got dressed before lunch.", "I felt tired when I woke up.",
      "My clothes were on the chair.", "There is nothing about dressing in my notes.",
      "I slept badly last night.", "My husband was there while I got dressed.",
      "Someone was in the room.", "I had breakfast after getting dressed.",
      "We went for a walk.", "I felt better in my blue shirt.",
      "I dressed with help.", "I had some support getting dressed but cannot say what kind.",
    ],
  };
  if (typeof module === "object" && module.exports) module.exports = training;
  else root.DiaryTraining = training;
})(globalThis);
