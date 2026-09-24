# Vamsi's Crypto AI

import 'package:flutter/material.dart';

void main() {
  runApp(const VamsiJarvisApp());
}

class VamsiJarvisApp extends StatelessWidget {
  const VamsiJarvisApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vamsi AI - Jarvis',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        primaryColor: Colors.blueAccent,
      ),
      home: const DashboardScreen(),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  // Demo live scanned crypto data
  final List<Map<String, dynamic>> cryptoData = [
    {
      'symbol': 'FET / USDT',
      'category': 'AI Coin',
      'price': '\$1.65',
      'change': '+11.5%',
      'rvol': '4.2x',
      'oi': '+26.0%',
      'signal': 'Upside Breakout 🟢',
      'isUpside': true,
    },
    {
      'symbol': 'ADA / USDT',
      'category': 'Altcoin',
      'price': '\$0.42',
      'change': '+8.1%',
      'rvol': '3.4x',
      'oi': '+19.2%',
      'signal': 'Strong Upside Breakout 🟢',
      'isUpside': true,
    },
    {
      'symbol': 'AAVE / USDT',
      'category': 'DeFi',
      'price': '\$145.00',
      'change': '-7.5%',
      'rvol': '3.1x',
      'oi': '+18.0%',
      'signal': 'Downside Breakout 🔴 (Short)',
      'isUpside': false,
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('🤖 VAMSI AI - JARVIS', style: TextStyle(color: Colors.blueAccent, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(onPressed: () {}, icon: const Icon(Icons.settings, color: Colors.white70)),
        ],
      ),
      body: Column(
        children: [
          // Voice Assistant Banner
          Container(
            padding: const EdgeInsets.all(16),
            margin: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.blueAccent.withOpacity(0.5)),
            ),
            child: const Row(
              children: [
                Icon(Icons.mic, color: Colors.blueAccent, size: 28),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'ஏங்க... 200+ காயின்களையும் ஸ்கேன் பண்ணிட்டேன்! FET & ADA நல்ல Upside Breakout-ல இருக்குங்க!',
                    style: TextStyle(color: Colors.white, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('🔥 LIVE MOMENTUM ALERTS', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
            ),
          ),

          // Crypto Cards List
          Expanded(
            child: ListView.builder(
              itemCount: cryptoData.length,
              itemBuilder: (context, index) {
                final item = cryptoData[index];
                return Card(
                  color: const Color(0xFF1E293B),
                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(item['symbol'], style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                            Text(item['change'], style: TextStyle(color: item['isUpside'] ? Colors.greenAccent : Colors.redAccent, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text('Price: ${item['price']}  |  RVOL: ${item['rvol']}  |  OI: ${item['oi']}', style: const TextStyle(color: Colors.white60, fontSize: 12)),
                        const SizedBox(height: 8),
                        Text('Signal: ${item['signal']}', style: TextStyle(color: item['isUpside'] ? Colors.greenAccent : Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      
      // Bottom Interactive Voice Button
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
        backgroundColor: Colors.blueAccent,
        icon: const Icon(Icons.graphic_eq, color: Colors.white),
        label: const Text('🎙️ HOLD TO SPEAK (VAMSI)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }
}

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vamsi-cryptex-bot.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cb5e7d80-4371-4843-8c78-375d8268bc1c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
