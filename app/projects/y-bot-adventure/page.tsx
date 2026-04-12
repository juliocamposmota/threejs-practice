import YBotAdventureScene from "@/components/YBotAdventure";

export default function YBotAdventure() {
  return (
    <main className="relative h-screen overflow-hidden">
      <div className="absolute inset-0">
        <YBotAdventureScene />
      </div>
      <h1
        className={`
          pointer-events-none
          absolute left-0 right-0 top-4 z-10
          text-center text-2xl font-bold
        `}>
        YBot Adventure
      </h1>
    </main>
  );
}