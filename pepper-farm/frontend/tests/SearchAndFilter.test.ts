describe('Search And Filter Features', () => {

  test('filters products by name', () => {
    const products = [
      { ProductName: 'Hot Sauce', Category: 'Sauce', Price: 10 },
      { ProductName: 'Chili Powder', Category: 'Spice', Price: 5 },
    ];

    const searchTerm = 'hot';

    const result = products.filter((product) =>
      product.ProductName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    expect(result).toHaveLength(1);
    expect(result[0].ProductName).toBe('Hot Sauce');
  });

  test('filters products by category', () => {
    const products = [
      { ProductName: 'Hot Sauce', Category: 'Sauce' },
      { ProductName: 'Chili Powder', Category: 'Spice' },
    ];

    const result = products.filter(
      (product) => product.Category === 'Sauce'
    );

    expect(result).toHaveLength(1);
    expect(result[0].Category).toBe('Sauce');
  });

  test('sorts products by price low to high', () => {
    const products = [
      { ProductName: 'A', Price: 30 },
      { ProductName: 'B', Price: 10 },
      { ProductName: 'C', Price: 20 },
    ];

    const result = [...products].sort((a, b) => a.Price - b.Price);

    expect(result[0].Price).toBe(10);
    expect(result[1].Price).toBe(20);
    expect(result[2].Price).toBe(30);
  });

  test('sorts products by price high to low', () => {
    const products = [
      { ProductName: 'A', Price: 30 },
      { ProductName: 'B', Price: 10 },
      { ProductName: 'C', Price: 20 },
    ];

    const result = [...products].sort((a, b) => b.Price - a.Price);

    expect(result[0].Price).toBe(30);
    expect(result[2].Price).toBe(10);
  });

  test('filters peppers by name', () => {
    const peppers = [
      { PepperName: 'Jalapeno' },
      { PepperName: 'Habanero' },
    ];

    const result = peppers.filter((pepper) =>
      pepper.PepperName.toLowerCase().includes('jala')
    );

    expect(result).toHaveLength(1);
    expect(result[0].PepperName).toBe('Jalapeno');
  });

  test('filters tasks by title', () => {
    const tasks = [
      { title: 'Spray greenhouse' },
      { title: 'Check sensors' },
    ];

    const result = tasks.filter((task) =>
      task.title.toLowerCase().includes('spray')
    );

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Spray greenhouse');
  });

  test('filters spray alerts by zone', () => {
    const alerts = [
      { ZoneName: 'Zone A' },
      { ZoneName: 'Zone B' },
    ];

    const result = alerts.filter((alert) =>
      alert.ZoneName.toLowerCase().includes('zone a')
    );

    expect(result).toHaveLength(1);
    expect(result[0].ZoneName).toBe('Zone A');
  });
});