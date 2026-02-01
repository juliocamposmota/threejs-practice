export default function Home() {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <main className="flex-col center items-center justify-center text-center">
        <h1>Welcome to Three.js Practice</h1>
        <p>See the projects below:</p>

        <ul className="list-disc list-inside">
          <li><a href="/projects/pepes-cube">Pepe&apos;s Cube</a></li>
        </ul>
      </main>
    </div>
  );
}
