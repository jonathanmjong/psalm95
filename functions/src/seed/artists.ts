import type { ArtistSeed } from '../types'

const m = (memberId: string, name: string) => ({ memberId, name })

/**
 * Curated starter roster. Not exhaustive — meant to seed a credible first
 * ranking board across regions/generations; the community grows it via
 * uploads. spotifyArtistId is left undefined where we're not fully certain
 * of the exact catalog match; the popularity provider marks those `stale`
 * until an admin/verified id is supplied.
 */
export const artistSeeds: ArtistSeed[] = [
  // --- K-pop, 1st gen ---
  { id: 'hot', name: 'H.O.T.', region: 'KR', type: 'group', generationId: 'kpop-gen1', members: [m('moon-heejun', 'Moon Hee-jun'), m('jang-woohyuk', 'Jang Woo-hyuk'), m('tony-ahn', 'Tony Ahn'), m('kangta', 'Kangta'), m('lee-jaewon', 'Lee Jae-won')] },
  { id: 'sechskies', name: 'Sechs Kies', region: 'KR', type: 'group', generationId: 'kpop-gen1', members: [m('eun-jiwon', 'Eun Ji-won'), m('kim-jaeduck', 'Kim Jae-duck'), m('lee-jaijin', 'Lee Jai-jin'), m('ko-jiyong', 'Ko Ji-yong'), m('jang-suwon', 'Jang Su-won'), m('kim-jiwon', 'Kim Ji-won')] },
  { id: 'ses', name: 'S.E.S.', region: 'KR', type: 'group', generationId: 'kpop-gen1', members: [m('bada', 'Bada'), m('eugene', 'Eugene'), m('shoo', 'Shoo')] },
  { id: 'shinhwa', name: 'Shinhwa', region: 'KR', type: 'group', generationId: 'kpop-gen1', members: [m('eric-mun', 'Eric Mun'), m('lee-minwoo', 'Lee Min-woo'), m('kim-dongwan', 'Kim Dong-wan'), m('shin-hyesung', 'Shin Hye-sung'), m('jun-jin', 'Jun Jin'), m('andy-lee', 'Andy Lee')] },

  // --- K-pop, 2nd gen ---
  { id: 'tvxq', name: 'TVXQ!', region: 'KR', type: 'group', generationId: 'kpop-gen2', spotifyArtistId: '0BUqQnog9gGCVzTVQqBBrl', members: [m('u-know-yunho', 'U-Know Yunho'), m('max-changmin', 'Max Changmin')] },
  { id: 'super-junior', name: 'Super Junior', region: 'KR', type: 'group', generationId: 'kpop-gen2', spotifyArtistId: '3qFo8vLYAeRhutxYs1p0kW', members: [m('leeteuk', 'Leeteuk'), m('heechul', 'Heechul'), m('yesung', 'Yesung'), m('kangin', 'Kangin'), m('shindong', 'Shindong'), m('sungmin', 'Sungmin'), m('eunhyuk', 'Eunhyuk'), m('donghae', 'Donghae'), m('siwon', 'Siwon'), m('ryeowook', 'Ryeowook'), m('kyuhyun', 'Kyuhyun')] },
  { id: 'snsd', name: "Girls' Generation", region: 'KR', type: 'group', generationId: 'kpop-gen2', spotifyArtistId: '0Y3AwBFvSnV6D653N0FvNw', members: [m('taeyeon', 'Taeyeon'), m('sunny', 'Sunny'), m('tiffany', 'Tiffany'), m('hyoyeon', 'Hyoyeon'), m('yuri', 'Yuri'), m('sooyoung', 'Sooyoung'), m('yoona', 'Yoona'), m('seohyun', 'Seohyun')] },
  { id: 'bigbang', name: 'BIGBANG', region: 'KR', type: 'group', generationId: 'kpop-gen2', spotifyArtistId: '1oSPZhvZMIrWW5I41I9Ic1', members: [m('gdragon', 'G-Dragon'), m('taeyang', 'Taeyang'), m('daesung', 'Daesung'), m('seungri', 'Seungri')] },
  { id: 'shinee', name: 'SHINee', region: 'KR', type: 'group', generationId: 'kpop-gen2', spotifyArtistId: '2H2sjqzSb5AiSTFbxOcRA6', members: [m('onew', 'Onew'), m('key', 'Key'), m('minho', 'Minho'), m('taemin', 'Taemin')] },
  { id: '2ne1', name: '2NE1', region: 'KR', type: 'group', generationId: 'kpop-gen2', spotifyArtistId: '3IuAmBOSAo0EIZLDVEkkND', members: [m('cl', 'CL'), m('dara', 'Dara'), m('bom', 'Bom'), m('minzy', 'Minzy')] },
  { id: 'wonder-girls', name: 'Wonder Girls', region: 'KR', type: 'group', generationId: 'kpop-gen2', members: [m('yeeun', 'Yeeun'), m('sunmi', 'Sunmi'), m('yubin', 'Yubin'), m('hyerim', 'Hyerim'), m('sohee', 'Sohee')] },
  { id: 'kara', name: 'KARA', region: 'KR', type: 'group', generationId: 'kpop-gen2', members: [m('park-gyuri', 'Park Gyuri'), m('han-seungyeon', 'Han Seungyeon'), m('goo-hara', 'Goo Hara'), m('kang-jiyoung', 'Kang Jiyoung'), m('nicole', 'Nicole')] },

  // --- K-pop, 3rd gen ---
  { id: 'bts', name: 'BTS', region: 'KR', type: 'group', generationId: 'kpop-gen3', spotifyArtistId: '3Nrfpe0tUJi4K4DXYWgMUX', members: [m('rm', 'RM'), m('jin', 'Jin'), m('suga', 'Suga'), m('j-hope', 'j-hope'), m('jimin', 'Jimin'), m('v', 'V'), m('jungkook', 'Jungkook')] },
  { id: 'exo', name: 'EXO', region: 'KR', type: 'group', generationId: 'kpop-gen3', spotifyArtistId: '2P0KDlt2GhOFqfBVJHhZW9', members: [m('xiumin', 'Xiumin'), m('suho', 'Suho'), m('lay', 'Lay'), m('baekhyun', 'Baekhyun'), m('chen', 'Chen'), m('chanyeol', 'Chanyeol'), m('do', 'D.O.'), m('kai', 'Kai'), m('sehun', 'Sehun')] },
  { id: 'twice', name: 'TWICE', region: 'KR', type: 'group', generationId: 'kpop-gen3', spotifyArtistId: '7n2Ycct7Beij7Dj7meI4X0', members: [m('nayeon', 'Nayeon'), m('jeongyeon', 'Jeongyeon'), m('momo', 'Momo'), m('sana', 'Sana'), m('jihyo', 'Jihyo'), m('mina', 'Mina'), m('dahyun', 'Dahyun'), m('chaeyoung', 'Chaeyoung'), m('tzuyu', 'Tzuyu')] },
  { id: 'blackpink', name: 'BLACKPINK', region: 'KR', type: 'group', generationId: 'kpop-gen3', spotifyArtistId: '41MozSoPIsD1dJM0CLPjZF', members: [m('jisoo', 'Jisoo'), m('jennie', 'Jennie'), m('rose', 'Rosé'), m('lisa', 'Lisa')] },
  { id: 'red-velvet', name: 'Red Velvet', region: 'KR', type: 'group', generationId: 'kpop-gen3', spotifyArtistId: '1z4g3DjTBBZKhvAroFlhOM', members: [m('irene', 'Irene'), m('seulgi', 'Seulgi'), m('wendy', 'Wendy'), m('joy', 'Joy'), m('yeri', 'Yeri')] },
  { id: 'seventeen', name: 'SEVENTEEN', region: 'KR', type: 'group', generationId: 'kpop-gen3', spotifyArtistId: '3qm84nBOXaEQyeNGoWv0UD', members: [m('s-coups', 'S.Coups'), m('jeonghan', 'Jeonghan'), m('joshua', 'Joshua'), m('jun', 'Jun'), m('hoshi', 'Hoshi'), m('wonwoo', 'Wonwoo'), m('woozi', 'Woozi'), m('the8', 'The8'), m('mingyu', 'Mingyu'), m('dk', 'DK'), m('seungkwan', 'Seungkwan'), m('vernon', 'Vernon'), m('dino', 'Dino')] },
  { id: 'mamamoo', name: 'MAMAMOO', region: 'KR', type: 'group', generationId: 'kpop-gen3', spotifyArtistId: '0b1sIic4h9OyDPGxDwzYVT', members: [m('solar', 'Solar'), m('moonbyul', 'Moonbyul'), m('wheein', 'Wheein'), m('hwasa', 'Hwasa')] },
  { id: 'got7', name: 'GOT7', region: 'KR', type: 'group', generationId: 'kpop-gen3', spotifyArtistId: '5JQVQrmVaol9pV9dK2Rprr', members: [m('jb', 'JB'), m('mark', 'Mark'), m('jackson', 'Jackson'), m('jinyoung', 'Jinyoung'), m('youngjae', 'Youngjae'), m('bambam', 'BamBam'), m('yugyeom', 'Yugyeom')] },

  // --- K-pop, 4th gen ---
  { id: 'stray-kids', name: 'Stray Kids', region: 'KR', type: 'group', generationId: 'kpop-gen4', spotifyArtistId: '2dTAdgLJEbFRz0Wf3ZjkPT', members: [m('bang-chan', 'Bang Chan'), m('lee-know', 'Lee Know'), m('changbin', 'Changbin'), m('hyunjin', 'Hyunjin'), m('han', 'Han'), m('felix', 'Felix'), m('seungmin', 'Seungmin'), m('i-n', 'I.N')] },
  { id: 'itzy', name: 'ITZY', region: 'KR', type: 'group', generationId: 'kpop-gen4', spotifyArtistId: '2KjD07AVlDphOTHFqYFYb2', members: [m('yeji', 'Yeji'), m('lia', 'Lia'), m('ryujin', 'Ryujin'), m('chaeryeong', 'Chaeryeong'), m('yuna', 'Yuna')] },
  { id: 'ateez', name: 'ATEEZ', region: 'KR', type: 'group', generationId: 'kpop-gen4', spotifyArtistId: '6TIYQ3jFPwQSRmorSezPxX', members: [m('hongjoong', 'Hongjoong'), m('seonghwa', 'Seonghwa'), m('yunho', 'Yunho'), m('yeosang', 'Yeosang'), m('san', 'San'), m('mingi', 'Mingi'), m('wooyoung', 'Wooyoung'), m('jongho', 'Jongho')] },
  { id: 'txt', name: 'TOMORROW X TOGETHER', region: 'KR', type: 'group', generationId: 'kpop-gen4', spotifyArtistId: '0ghlgldX5Dd6720Q3qFyQB', members: [m('soobin', 'Soobin'), m('yeonjun', 'Yeonjun'), m('beomgyu', 'Beomgyu'), m('taehyun', 'Taehyun'), m('hueningkai', 'Hueningkai')] },
  { id: 'aespa', name: 'aespa', region: 'KR', type: 'group', generationId: 'kpop-gen4', spotifyArtistId: '6VvvXOWpNQyusiZctnDCoy', members: [m('karina', 'Karina'), m('giselle', 'Giselle'), m('winter', 'Winter'), m('ningning', 'Ningning')] },
  { id: 'enhypen', name: 'ENHYPEN', region: 'KR', type: 'group', generationId: 'kpop-gen4', spotifyArtistId: '5t6VW6koHK7HScLXqcSXCS', members: [m('jungwon', 'Jungwon'), m('heeseung', 'Heeseung'), m('jay', 'Jay'), m('jake', 'Jake'), m('sunghoon', 'Sunghoon'), m('sunoo', 'Sunoo'), m('ni-ki', 'Ni-ki')] },
  { id: 'ive', name: 'IVE', region: 'KR', type: 'group', generationId: 'kpop-gen4', spotifyArtistId: '6RHTUrRF63xao58xh9Qshm', members: [m('yujin', 'Yujin'), m('gaeul', 'Gaeul'), m('rei', 'Rei'), m('wonyoung', 'Wonyoung'), m('liz', 'Liz'), m('leeseo', 'Leeseo')] },
  { id: 'le-sserafim', name: 'LE SSERAFIM', region: 'KR', type: 'group', generationId: 'kpop-gen4', spotifyArtistId: '4KWTAlx2RvbpseOGMEmROQ', members: [m('sakura', 'Sakura'), m('kim-chaewon', 'Kim Chaewon'), m('huh-yunjin', 'Huh Yunjin'), m('kazuha', 'Kazuha'), m('hong-eunchae', 'Hong Eunchae')] },
  { id: 'newjeans', name: 'NewJeans', region: 'KR', type: 'group', generationId: 'kpop-gen4', spotifyArtistId: '6HvZYsbFfjnjFrWF950C9d', members: [m('minji', 'Minji'), m('hanni', 'Hanni'), m('danielle', 'Danielle'), m('haerin', 'Haerin'), m('hyein', 'Hyein')] },
  { id: 'gidle', name: '(G)I-DLE', region: 'KR', type: 'group', generationId: 'kpop-gen4', spotifyArtistId: '5MnFhw02EqiwWAAKX4YFrs', members: [m('miyeon', 'Miyeon'), m('minnie', 'Minnie'), m('soyeon', 'Soyeon'), m('yuqi', 'Yuqi'), m('shuhua', 'Shuhua')] },

  // --- K-pop, 5th gen ---
  { id: 'riize', name: 'RIIZE', region: 'KR', type: 'group', generationId: 'kpop-gen5', spotifyArtistId: '2y8Jo9CKhJvtfeKl3T3xrf', members: [m('shotaro', 'Shotaro'), m('eunseok', 'Eunseok'), m('sungchan', 'Sungchan'), m('wonbin', 'Wonbin'), m('soobin-riize', 'Soobin'), m('anton', 'Anton')] },
  { id: 'babymonster', name: 'BABYMONSTER', region: 'KR', type: 'group', generationId: 'kpop-gen5', spotifyArtistId: '3XenIptt0ZChb71GgOA5vy', members: [m('ruka', 'Ruka'), m('asa', 'Asa'), m('pharita', 'Pharita'), m('ahyeon', 'Ahyeon'), m('rora', 'Rora'), m('rami', 'Rami'), m('chiquita', 'Chiquita')] },
  { id: 'illit', name: 'ILLIT', region: 'KR', type: 'group', generationId: 'kpop-gen5', members: [m('yunah', 'Yunah'), m('minju', 'Minju'), m('moka', 'Moka'), m('wonhee', 'Wonhee'), m('iroha', 'Iroha')] },

  // --- J-pop ---
  { id: 'arashi', name: 'Arashi', region: 'JP', type: 'group', generationId: 'jpop-classic', spotifyArtistId: '3zN9BiKQwq0KJRWDh0mCsz', members: [m('satoshi-ohno', 'Satoshi Ohno'), m('sho-sakurai', 'Sho Sakurai'), m('masaki-aiba', 'Masaki Aiba'), m('kazunari-ninomiya', 'Kazunari Ninomiya'), m('jun-matsumoto', 'Jun Matsumoto')] },
  { id: 'akb48', name: 'AKB48', region: 'JP', type: 'group', generationId: 'jpop-classic', spotifyArtistId: '7JpCsQtd6HWJvfXAaeFuvW', members: [m('rotating-lineup', 'Rotating lineup')] },
  { id: 'perfume', name: 'Perfume', region: 'JP', type: 'group', generationId: 'jpop-classic', spotifyArtistId: '52iwsT98xCoGgiGntTiWEc', members: [m('a-chan', 'A-chan'), m('kashiyuka', 'Kashiyuka'), m('nocchi', 'Nocchi')] },
  { id: 'babymetal', name: 'BABYMETAL', region: 'JP', type: 'group', generationId: 'jpop-modern', spotifyArtistId: '2CmyKp0BAzooaOtybkwe33', members: [m('su-metal', 'Su-metal'), m('moametal', 'Moametal')] },
  { id: 'yoasobi', name: 'YOASOBI', region: 'JP', type: 'group', generationId: 'jpop-modern', spotifyArtistId: '2G0ADgvTLU4Ns3PA9jPmZk', members: [m('ayase', 'Ayase'), m('ikura', 'Ikura')] },

  // --- C-pop ---
  { id: 'jay-chou', name: 'Jay Chou', region: 'CN', type: 'solo', generationId: 'cpop-classic', spotifyArtistId: '2ncn9wGmFvFxVzFcO88f7B', members: [m('jay-chou', 'Jay Chou')] },
  { id: 'faye-wong', name: 'Faye Wong', region: 'CN', type: 'solo', generationId: 'cpop-classic', members: [m('faye-wong', 'Faye Wong')] },
  { id: 'gem', name: 'G.E.M.', region: 'CN', type: 'solo', generationId: 'cpop-modern', spotifyArtistId: '3qQvraTVUR3sqCNBHSp5t9', members: [m('gem', 'G.E.M.')] },
  { id: 'mayday', name: 'Mayday', region: 'CN', type: 'group', generationId: 'cpop-classic', spotifyArtistId: '2gosLxsBIndzeIYNMSAgtd', members: [m('ashin', 'Ashin'), m('monster', 'Monster'), m('stone', 'Stone'), m('masa', 'Masa'), m('guanyou', 'Guan You')] },
  { id: 'tfboys', name: 'TFBOYS', region: 'CN', type: 'group', generationId: 'cpop-modern', members: [m('wang-junkai', 'Wang Junkai'), m('wang-yuan', 'Wang Yuan'), m('jackson-yee', 'Jackson Yee')] },
]
